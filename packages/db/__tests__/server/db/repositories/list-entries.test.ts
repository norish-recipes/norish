// @vitest-environment node
/**
 * Tags, Cuisines and Categories as household lists (ADR-0043), against real Postgres with two
 * households: unique on the fold within a household, never offered or attached across one, kept
 * until deleted, merged on a rename; and the races the database decides.
 */
import { randomUUID } from "node:crypto";
import { count, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@norish/db/drizzle";
import { attachCategoriesToRecipeByInputTx } from "@norish/db/repositories/categories";
import { getRecipeCuisines } from "@norish/db/repositories/cuisines";
import { ForeignHouseholdReferenceError } from "@norish/db/repositories/household-rows";
import {
  addEntry,
  deleteEntry,
  entriesByFoldTx,
  listEntries,
  mergeEntries,
  mergeEntryTx,
  recipeEntryNames,
  renameEntry,
  replaceRecipeEntriesByNameTx,
  replaceRecipeEntryIdsTx,
} from "@norish/db/repositories/list-entries";
import {
  createRecipeWithRefs,
  getRecipeFull,
  listRecipes,
  updateRecipeWithRefs,
} from "@norish/db/repositories/recipes";
import { appendRecipeTags } from "@norish/db/repositories/tags";
import { recipeCuisines, recipes, recipeTags, tags } from "@norish/db/schema";
import { FullRecipeInsertSchema } from "@norish/shared/contracts/zod";

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
  db.transaction((tx) => replaceRecipeEntriesByNameTx(tx, "tag", recipeId, names));
const rowCount = async (name: string) =>
  (await getTestDb().select({ n: count() }).from(tags).where(eq(tags.nameFold, name)))[0]!.n;

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

  describe("a recipe save from an editor", () => {
    const names = (kind: "tag" | "category") =>
      listEntries(kind, ann.household).then((entries) =>
        entries.filter((entry) => !entry.instance).map((entry) => entry.name)
      );

    it("attaches the entries the list has and creates none, neither on update nor on create", async () => {
      await addEntry("tag", ann.household, "Quick");

      await updateRecipeWithRefs(
        ann.recipe,
        ann.id,
        { tags: [{ name: "quick" }, { name: "Typed" }], categories: ["Typed category"] },
        undefined,
        { createEntries: false }
      );

      expect(await tagsOf(ann.recipe)).toEqual(["Quick"]);
      expect(await names("tag")).toEqual(["Quick"]);
      expect(await names("category")).toEqual([]);

      const recipeId = crypto.randomUUID();

      await createRecipeWithRefs(
        recipeId,
        ann.id,
        FullRecipeInsertSchema.parse({
          name: "Soup",
          servings: 2,
          systemUsed: "metric",
          tags: [{ name: "Typed" }],
        }),
        { createEntries: false }
      );

      expect(await tagsOf(recipeId)).toEqual([]);
      expect(await names("tag")).toEqual(["Quick"]);
    });

    it("does not bring back a name that was deleted while the editor was open", async () => {
      const { entry } = (await addEntry("tag", ann.household, "Gone"))!;

      await deleteEntry("tag", ann.household, { id: entry.id, version: entry.version });
      await updateRecipeWithRefs(ann.recipe, ann.id, { tags: [{ name: "Gone" }] }, undefined, {
        createEntries: false,
      });

      expect(await tagsOf(ann.recipe)).toEqual([]);
      expect(await names("tag")).toEqual([]);
    });

    it("attaches the household Category the reader picked over a built-in it is an alias of", async () => {
      await addEntry("category", ann.household, "Dinners");

      await updateRecipeWithRefs(ann.recipe, ann.id, { categories: ["Dinners"] }, undefined, {
        createEntries: false,
      });

      expect((await getRecipeFull(ann.recipe))?.categories).toEqual(["Dinners"]);
    });

    it("attaches nothing for a picked Category deleted since, even when it is a built-in's alias", async () => {
      const { entry } = (await addEntry("category", ann.household, "Dinners"))!;

      await deleteEntry("category", ann.household, { id: entry.id, version: entry.version });
      await updateRecipeWithRefs(ann.recipe, ann.id, { categories: ["Dinners"] }, undefined, {
        createEntries: false,
      });

      expect((await getRecipeFull(ann.recipe))?.categories).toEqual([]);
    });

    it("maps an alias to its built-in for the callers that create: imports, AI and the REST routes", async () => {
      await updateRecipeWithRefs(ann.recipe, ann.id, { categories: ["Dinners"] });

      expect((await getRecipeFull(ann.recipe))?.categories).toEqual(["Dinner"]);
    });

    it("creates the entries a plain save names, as imports, AI and the REST routes do", async () => {
      await updateRecipeWithRefs(ann.recipe, ann.id, {
        tags: [{ name: "Typed" }],
        categories: ["Typed category"],
      });

      expect(await tagsOf(ann.recipe)).toEqual(["Typed"]);
      expect(await names("tag")).toEqual(["Typed"]);
      expect(await names("category")).toEqual(["Typed category"]);
    });
  });

  it("refuses another household's Cuisine on a recipe, but keeps one the recipe carries", async () => {
    const own = (await addEntry("cuisine", ann.household, "Grandma's"))!.entry;
    const foreign = (await addEntry("cuisine", bob.household, "Bob's"))!.entry;
    const [instance] = (await listEntries("cuisine", ann.household)).filter((e) => e.instance);

    await db.transaction((tx) =>
      replaceRecipeEntryIdsTx(tx, "cuisine", ann.recipe, [own.id, instance!.id])
    );
    await expect(
      db.transaction((tx) => replaceRecipeEntryIdsTx(tx, "cuisine", ann.recipe, [foreign.id]))
    ).rejects.toThrow(ForeignHouseholdReferenceError);

    // A recipe that moved household still carries its old household's entry until ticket 09.
    await getTestDb().insert(recipeCuisines).values({ recipeId: bob.recipe, cuisineId: own.id });
    await db.transaction((tx) => replaceRecipeEntryIdsTx(tx, "cuisine", bob.recipe, [own.id]));
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
    const renamed = await renameEntry("tag", ann.household, barbecue!, "bbq");

    expect(renamed).toMatchObject({
      applied: true,
      value: { merged: true, entry: { id: bbq!.id } },
    });
    expect(await tagsOf(ann.recipe)).toEqual(["BBQ"]);
    expect(await tagsOf(other.id)).toEqual(["BBQ"]);
    expect(await listEntries("tag", ann.household)).toEqual([
      expect.objectContaining({ id: bbq!.id, name: "BBQ", recipeCount: 2 }),
    ]);
    expect(await renameEntry("tag", bob.household, renamed!.value!.entry, "Grill")).toBeNull();
    expect(await renameEntry("tag", ann.household, renamed!.value!.entry, "B.B.Q.")).toMatchObject({
      value: { merged: false, entry: { name: "B.B.Q." } },
    });
  });

  it("merges onto an instance entry, and only the scope's own source", async () => {
    const mine = (await addEntry("category", ann.household, "Supper"))!.entry;
    const [dinner] = (await listEntries("category", ann.household)).filter(
      (e) => e.name === "Dinner"
    );

    await db.transaction((tx) => attachCategoriesToRecipeByInputTx(tx, ann.recipe, ["Supper"]));

    expect(await mergeEntries("category", bob.household, mine, dinner!)).toBeNull();
    expect(await mergeEntries("category", ann.household, mine, dinner!)).toMatchObject({
      value: { id: dinner!.id },
    });
    expect((await getRecipeFull(ann.recipe))?.categories).toEqual(["Dinner"]);
  });

  it("merges a source more recipes carry than a statement can bind values for", async () => {
    // Three binds a link would exceed PostgreSQL's 65,535 if the merge listed the links.
    const carried = 21_846;
    const [soja, soy] = await Promise.all([
      addEntry("tag", ann.household, "soja"),
      addEntry("tag", ann.household, "soy"),
    ]);
    const ids = Array.from({ length: carried }, () => randomUUID());

    for (let from = 0; from < carried; from += 5000) {
      const chunk = ids.slice(from, from + 5000);

      await getTestDb()
        .insert(recipes)
        .values(chunk.map((id) => ({ id, userId: ann.id, householdId: ann.household, name: id })));
      await getTestDb()
        .insert(recipeTags)
        .values(chunk.map((recipeId) => ({ recipeId, tagId: soja!.entry.id })));
    }

    expect(await mergeEntries("tag", ann.household, soja!.entry, soy!.entry)).toMatchObject({
      value: { id: soy!.entry.id },
    });
    expect((await listEntries("tag", ann.household)).map((e) => [e.name, e.recipeCount])).toEqual([
      ["soy", carried],
    ]);
  }, 60_000);

  it("deletes an entry off every recipe it was on, answering how many", async () => {
    const other = await createTestRecipe(ann.id, { name: "Ann's salad" });

    await attachTags(ann.recipe, ["soja", "tofu"]);
    await attachTags(other.id, ["soja"]);

    const soja = (await listEntries("tag", ann.household)).find((e) => e.name === "soja")!;

    expect(await deleteEntry("tag", bob.household, soja)).toBeNull();
    expect(await deleteEntry("tag", ann.household, soja)).toMatchObject({
      value: { detached: 2 },
    });
    expect(await tagsOf(ann.recipe)).toEqual(["tofu"]);
  });

  it("refuses a rename, merge or delete made against an older version, a merge bumping the target", async () => {
    const soja = (await addEntry("tag", ann.household, "soja"))!.entry;
    const soy = (await addEntry("tag", ann.household, "soy"))!.entry;
    const renamed = await renameEntry("tag", ann.household, soja, "Soja");

    expect(renamed).toMatchObject({ applied: true, value: { entry: { version: 2 } } });
    expect(await renameEntry("tag", ann.household, soja, "Tofu")).toEqual({
      applied: false,
      stale: true,
    });
    expect(await deleteEntry("tag", ann.household, soja)).toEqual({ applied: false, stale: true });
    expect(await mergeEntries("tag", ann.household, soy, soja)).toEqual({
      applied: false,
      stale: true,
    });

    const merged = await mergeEntries("tag", ann.household, soy, { id: soja.id, version: 2 });

    expect(merged).toMatchObject({ applied: true, value: { id: soja.id, version: 3 } });
    expect(await deleteEntry("tag", ann.household, { id: soja.id, version: 2 })).toEqual({
      applied: false,
      stale: true,
    });
    expect(await deleteEntry("tag", ann.household, { id: soja.id, version: 3 })).toEqual({
      applied: true,
      stale: false,
      value: { detached: 0 },
    });
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
          tx.insert(tags).values({ householdId: ann.household, name: "Soja", nameFold: "soja" }),
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
        (tx) => tx.delete(tags).where(eq(tags.id, soja.id)),
        [() => renameEntry("tag", ann.household, soja, "Tofu")]
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
        [() => mergeEntries("tag", ann.household, soja!, soy!)]
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
          await tx.select({ id: tags.id }).from(tags).where(eq(tags.id, soja!.id)).for("update");
          await mergeEntryTx(tx, "tag", soja!.id, soy!.id);
        },
        [
          () =>
            db.transaction((tx) =>
              entriesByFoldTx(tx, "tag", ann.household, ["soja"], { create: true })
            ),
        ]
      );

      expect(run?.status).toBe("fulfilled");
      expect((await listEntries("tag", ann.household)).map((e) => e.name)).toEqual(["soja", "soy"]);
    });
  });
});
