// @vitest-environment node
/**
 * Tags, Cuisines and Categories as household lists (ADR-0043), against real Postgres with two
 * households: unique on the fold within a household, never offered or attached across one, kept
 * until deleted, merged on a rename; and the races the database decides.
 */
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@norish/db/drizzle";
import { attachCategoriesToRecipeByInputTx } from "@norish/db/repositories/categories";
import { getRecipeCuisines, replaceRecipeCuisinesTx } from "@norish/db/repositories/cuisines";
import { ForeignHouseholdReferenceError } from "@norish/db/repositories/household-rows";
import {
  addEntry,
  deleteEntry,
  entriesForNamesTx,
  listEntries,
  mergeEntries,
  mergeEntryTx,
  recipeEntryNames,
  renameEntry,
  replaceRecipeEntriesByNameTx,
} from "@norish/db/repositories/list-entries";
import { getRecipeFull, listRecipes } from "@norish/db/repositories/recipes";
import { appendRecipeTags, attachTagsToRecipeByInputTx } from "@norish/db/repositories/tags";

import {
  createTestRecipe,
  createTestUser,
  getTestDb,
  testHouseholdOf,
} from "../../../helpers/db-test-helpers";
import { raceBehind } from "../../../helpers/lock-race";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

const testBase = new RepositoryTestBase("test_list_entries");

const tagsOf = (recipeId: string) => recipeEntryNames("tag", recipeId);
const attachTags = (recipeId: string, names: string[]) =>
  db.transaction((tx) => attachTagsToRecipeByInputTx(tx, recipeId, names));
const rowCount = async (name: string) =>
  (
    await getTestDb().execute<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM tags WHERE name_fold = ${name}`
    )
  ).rows[0]!.n;

describe("household lists", () => {
  let ann: { id: string; household: string; recipe: string };
  let bob: { id: string; household: string; recipe: string };

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    await testBase.beforeEachTest();

    const member = async (name: string) => {
      const user = await createTestUser();

      return {
        id: user.id,
        household: testHouseholdOf(user.id),
        recipe: (await createTestRecipe(user.id, { name })).id,
      };
    };

    ann = await member("Ann's soup");
    bob = await member("Bob's stew");
    // The pool is reset per suite; warm it so a race's first query does not pay for it.
    await listEntries("tag", ann.household);
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  it("is unique on the fold within a household and separate between households", async () => {
    const first = await addEntry("tag", ann.household, "Gluten-free");
    const again = await addEntry("tag", ann.household, "  gluten FREE ");
    const other = await addEntry("tag", bob.household, "GLUTEN FREE");

    expect(first).toMatchObject({ created: true, entry: { name: "Gluten-free", instance: false } });
    expect(again).toEqual({ created: false, entry: first!.entry });
    expect(other?.created).toBe(true);
    expect(other?.entry.id).not.toBe(first?.entry.id);
    expect(await rowCount("gluten free")).toBe(2);
    expect(await addEntry("tag", ann.household, " <b></b> ")).toBeNull();
  });

  it("offers a household its own entries and the instance's, never another's", async () => {
    await attachTags(ann.recipe, ["soja", "Italian night"]);
    await attachTags(bob.recipe, ["Soja"]);

    expect((await listEntries("tag", ann.household)).map((e) => [e.name, e.recipeCount])).toEqual([
      ["Italian night", 1],
      ["soja", 1],
    ]);
    expect((await listEntries("tag", bob.household)).map((e) => e.name)).toEqual(["Soja"]);

    const categories = await listEntries("category", bob.household);

    expect(
      categories
        .filter((e) => e.instance)
        .map((e) => e.name)
        .sort()
    ).toEqual(["Breakfast", "Dinner", "Lunch", "Snack"]);
  });

  it("attaches a recipe's names from its own household's list, a built-in from the instance's", async () => {
    await addEntry("tag", bob.household, "soja");
    await attachTags(ann.recipe, ["SOJA", "soja"]);
    await db.transaction((tx) => attachCategoriesToRecipeByInputTx(tx, ann.recipe, ["dinner"]));

    const [annSoja] = await listEntries("tag", ann.household);

    expect(annSoja).toMatchObject({ name: "SOJA", recipeCount: 1 });
    expect(await tagsOf(ann.recipe)).toEqual(["SOJA"]);
    expect((await getRecipeFull(ann.recipe))?.categories).toEqual(["Dinner"]);
    expect((await listEntries("category", ann.household)).filter((e) => !e.instance)).toEqual([]);
  });

  it("refuses another household's Cuisine on a recipe, but keeps one the recipe carries", async () => {
    const own = (await addEntry("cuisine", ann.household, "Grandma's"))!.entry;
    const foreign = (await addEntry("cuisine", bob.household, "Bob's"))!.entry;
    const [instance] = (await listEntries("cuisine", ann.household)).filter((e) => e.instance);

    await db.transaction((tx) => replaceRecipeCuisinesTx(tx, ann.recipe, [own.id, instance!.id]));
    await expect(
      db.transaction((tx) => replaceRecipeCuisinesTx(tx, ann.recipe, [foreign.id]))
    ).rejects.toThrow(ForeignHouseholdReferenceError);

    // A recipe that moved household still carries its old household's entry until ticket 09.
    await getTestDb().execute(
      sql`INSERT INTO recipe_cuisines (recipe_id, cuisine_id) VALUES (${bob.recipe}, ${own.id})`
    );
    await db.transaction((tx) => replaceRecipeCuisinesTx(tx, bob.recipe, [own.id]));
    expect((await getRecipeCuisines(bob.recipe)).map((c) => c.name)).toEqual(["Grandma's"]);
  });

  it("filters across households on the folded name", async () => {
    await attachTags(ann.recipe, ["Soja"]);
    await attachTags(bob.recipe, ["soja!"]);

    const viewer = { userId: ann.id, householdId: ann.household, isServerAdmin: false };
    const { recipes } = await listRecipes(viewer, 50, 0, undefined, undefined, ["SOJA"]);

    expect(recipes.map((r) => r.name).sort()).toEqual(["Ann's soup", "Bob's stew"]);
  });

  it("keeps an entry no recipe carries any more", async () => {
    await attachTags(ann.recipe, ["soja"]);
    await attachTags(ann.recipe, []);

    expect((await listEntries("tag", ann.household)).map((e) => [e.name, e.recipeCount])).toEqual([
      ["soja", 0],
    ]);
  });

  it("merges a rename onto a name the household has, without duplicate attachments", async () => {
    const other = await createTestRecipe(ann.id, { name: "Ann's salad" });

    await attachTags(ann.recipe, ["BBQ", "Barbecue"]);
    await attachTags(other.id, ["Barbecue"]);

    const entries = await listEntries("tag", ann.household);
    const bbq = entries.find((e) => e.name === "BBQ");
    const barbecue = entries.find((e) => e.name === "Barbecue");
    const renamed = await renameEntry("tag", ann.household, barbecue!.id, "bbq");

    expect(renamed).toEqual({ merged: true, entry: expect.objectContaining({ id: bbq!.id }) });
    expect(await tagsOf(ann.recipe)).toEqual(["BBQ"]);
    expect(await tagsOf(other.id)).toEqual(["BBQ"]);
    expect(await listEntries("tag", ann.household)).toEqual([
      expect.objectContaining({ id: bbq!.id, name: "BBQ", recipeCount: 2 }),
    ]);
    expect(await renameEntry("tag", bob.household, bbq!.id, "Grill")).toBeNull();
    expect(await renameEntry("tag", ann.household, bbq!.id, "B.B.Q.")).toMatchObject({
      merged: false,
      entry: { name: "B.B.Q." },
    });
  });

  it("merges onto an instance entry, and only the scope's own source", async () => {
    const mine = (await addEntry("category", ann.household, "Supper"))!.entry;
    const [dinner] = (await listEntries("category", ann.household)).filter(
      (e) => e.name === "Dinner"
    );

    await db.transaction((tx) => attachCategoriesToRecipeByInputTx(tx, ann.recipe, ["Supper"]));

    expect(await mergeEntries("category", bob.household, mine.id, dinner!.id)).toBeNull();
    expect(await mergeEntries("category", ann.household, mine.id, dinner!.id)).toMatchObject({
      id: dinner!.id,
    });
    expect((await getRecipeFull(ann.recipe))?.categories).toEqual(["Dinner"]);
  });

  it("deletes an entry off every recipe it was on, answering how many", async () => {
    const other = await createTestRecipe(ann.id, { name: "Ann's salad" });

    await attachTags(ann.recipe, ["soja", "tofu"]);
    await attachTags(other.id, ["soja"]);

    const soja = (await listEntries("tag", ann.household)).find((e) => e.name === "soja")!;

    expect(await deleteEntry("tag", bob.household, soja.id)).toBeNull();
    expect(await deleteEntry("tag", ann.household, soja.id)).toEqual({ detached: 2 });
    expect(await tagsOf(ann.recipe)).toEqual(["tofu"]);
  });

  it("appends enrichment Tags into the recipe's household list", async () => {
    await addEntry("tag", bob.household, "vegan");

    expect(await appendRecipeTags(ann.recipe, ["Vegan", "vegan"])).toEqual({
      added: ["Vegan"],
      allTags: ["Vegan"],
    });
    expect((await listEntries("tag", ann.household)).map((e) => e.name)).toEqual(["Vegan"]);
  });

  describe("races the database decides", () => {
    it("two adds of one name end with one entry, neither failing", async () => {
      const runs = await raceBehind(
        (tx) =>
          tx.execute(
            sql`INSERT INTO tags (household_id, name, name_fold) VALUES (${ann.household}, 'Soja', 'soja')`
          ),
        [() => addEntry("tag", ann.household, "soja"), () => addEntry("tag", ann.household, "SOJA")]
      );

      expect(runs.map((run) => run.status)).toEqual(["fulfilled", "fulfilled"]);
      expect(runs.map((run) => (run.status === "fulfilled" ? run.value : null))).toEqual([
        { created: false, entry: expect.objectContaining({ name: "Soja" }) },
        { created: false, entry: expect.objectContaining({ name: "Soja" }) },
      ]);
      expect(await rowCount("soja")).toBe(1);
    });

    it("a rename behind a delete finds nothing to rename", async () => {
      const soja = (await addEntry("tag", ann.household, "soja"))!.entry;
      const [run] = await raceBehind(
        (tx) => tx.execute(sql`DELETE FROM tags WHERE id = ${soja.id}`),
        [() => renameEntry("tag", ann.household, soja.id, "Tofu")]
      );

      expect(run).toEqual({ status: "fulfilled", value: null });
      expect(await listEntries("tag", ann.household)).toEqual([]);
    });

    it("a merge behind an attach moves the attach too", async () => {
      const other = await createTestRecipe(ann.id, { name: "Ann's salad" });

      await attachTags(ann.recipe, ["soja", "soy"]);

      const [soja, soy] = await listEntries("tag", ann.household);
      const [run] = await raceBehind(
        (tx) => replaceRecipeEntriesByNameTx(tx, "tag", other.id, ["soja"]),
        [() => mergeEntries("tag", ann.household, soja!.id, soy!.id)]
      );

      expect(run?.status).toBe("fulfilled");
      expect(await tagsOf(other.id)).toEqual(["soy"]);
      expect(await tagsOf(ann.recipe)).toEqual(["soy"]);
    });

    it("an attach behind a merge makes the name again", async () => {
      await attachTags(ann.recipe, ["soja", "soy"]);

      const [soja, soy] = await listEntries("tag", ann.household);
      const [run] = await raceBehind(
        async (tx) => {
          await tx.execute(sql`SELECT id FROM tags WHERE id = ${soja!.id} FOR UPDATE`);
          await mergeEntryTx(tx, "tag", soja!.id, soy!.id);
        },
        [
          () =>
            db.transaction((tx) =>
              entriesForNamesTx(tx, "tag", ann.household, ["soja"], { create: true })
            ),
        ]
      );

      expect(run?.status).toBe("fulfilled");
      expect((await listEntries("tag", ann.household)).map((e) => e.name)).toEqual(["soja", "soy"]);
    });
  });
});
