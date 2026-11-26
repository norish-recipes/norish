// @vitest-environment node
/**
 * Leaves and joins racing the writes they read to decide (ADR-0041): the test holds a lock, each
 * operation is seen waiting on it, the test lets go, and every settlement and both invariants hold.
 */
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { isStaleIngredientReference } from "@norish/db/repositories/constraint-violation";
import {
  deleteAccount,
  getHouseholdIdForUser,
  joinHousehold,
  moveToHouseholdOfOne,
} from "@norish/db/repositories/households";
import { mergeCatalogueIngredients } from "@norish/db/repositories/ingredient-relocation";
import {
  addEntry,
  appendRecipeEntriesTx,
  deleteEntry,
  mergeEntries,
  recipeEntryNames,
} from "@norish/db/repositories/list-entries";
import * as recipeRepository from "@norish/db/repositories/recipes";
import { households, ingredientAliases, ingredients, recipes, tags } from "@norish/db/schema";

import { withResolvedIngredients } from "../../../../../shared-server/src/ingredients/recipe-lines";
import {
  createTestRecipe,
  createTestUser,
  getTestDb,
  insertTestRecipeLine,
  mintTestFood,
  readTestIngredient,
  readTestSpelling,
  setTestIngredients,
  testLineAliasIds,
  testLineFoodNames,
} from "../../../helpers/db-test-helpers";
import { expectNothingForeign } from "../../../helpers/household-invariants";
import { lockWaits, raceBehind, waitFor } from "../../../helpers/lock-race";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

const fulfilled = (value: unknown) => ({ status: "fulfilled", value });

describe("household move races", () => {
  const testBase = new RepositoryTestBase("test_household_move_races");

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    await testBase.beforeEachTest();
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  async function householdOf(userId: string): Promise<string> {
    return (await getHouseholdIdForUser(userId))!;
  }

  async function sharedHousehold() {
    const admin = (await createTestUser())!;
    const member = (await createTestUser())!;
    const householdId = await householdOf(admin.id);

    await joinHousehold(member.id, { householdId });

    return { admin, member, householdId };
  }

  /** The test's transaction holds `table`'s row `id`. */
  const holdRow =
    (table: typeof recipes | typeof ingredients | typeof tags | typeof households, id: string) =>
    (tx: Parameters<Parameters<ReturnType<typeof getTestDb>["transaction"]>[0]>[0]) =>
      tx.select({ id: table.id }).from(table).where(eq(table.id, id)).for("update");

  it("a save of the leaver's recipe resolved before the leave is sent back to resolve again", async () => {
    const { member, householdId } = await sharedHousehold();
    const recipe = await createTestRecipe(member.id);
    const line = {
      ingredientId: null,
      ingredientName: "gochujang",
      amount: 1,
      unit: null,
      systemUsed: "metric" as const,
      order: 0,
    };
    const resolvedInOld = await withResolvedIngredients(
      { systemUsed: "metric", recipeIngredients: [line] },
      { userId: member.id, householdId }
    );

    // The leave moves the recipe row first, so the save's update waits for it and then sees it moved.
    const settled = await raceBehind(holdRow(recipes, recipe.id), [
      () => moveToHouseholdOfOne(householdId, member.id),
      () => recipeRepository.updateRecipeWithRefs(recipe.id, member.id, resolvedInOld),
    ]);

    expect(settled[0]).toEqual(fulfilled(expect.objectContaining({ applied: true })));
    expect(settled[1]?.status).toBe("rejected");
    expect(isStaleIngredientReference((settled[1] as PromiseRejectedResult).reason)).toBe(true);

    const resolvedAgain = await withResolvedIngredients(
      { systemUsed: "metric", recipeIngredients: [line] },
      { userId: member.id, householdId: await householdOf(member.id) }
    );

    await recipeRepository.updateRecipeWithRefs(recipe.id, member.id, resolvedAgain);
    const [stored] = (await recipeRepository.getRecipeFull(recipe.id))!.recipeIngredients;

    expect((await testLineFoodNames(stored!.id!)).map((one) => one.food)).toEqual(["gochujang"]);
    await expectNothingForeign();
  });

  it.each(["leave first", "delete first"] as const)(
    "a housemate deleting a Tag the leaver's recipe carries: %s",
    async (order) => {
      const { member, householdId } = await sharedHousehold();
      const recipe = await createTestRecipe(member.id);

      await getTestDb().transaction((tx) => appendRecipeEntriesTx(tx, "tag", recipe.id, ["Spicy"]));
      const spicy = (await addEntry("tag", householdId, "Spicy"))!.entry;
      const leave = () => moveToHouseholdOfOne(householdId, member.id);
      const remove = () => deleteEntry("tag", householdId, spicy);

      const settled = await raceBehind(
        holdRow(tags, spicy.id),
        order === "leave first" ? [leave, remove] : [remove, leave]
      );

      expect(settled.map((one) => one.status)).toEqual(["fulfilled", "fulfilled"]);
      expect(await recipeEntryNames("tag", recipe.id)).toEqual(
        order === "leave first" ? ["Spicy"] : []
      );
      await expectNothingForeign();
    }
  );

  it("a housemate merging a Tag the leaver's recipe carries into another, before the leave", async () => {
    const { member, householdId } = await sharedHousehold();
    const recipe = await createTestRecipe(member.id);

    await getTestDb().transaction((tx) => appendRecipeEntriesTx(tx, "tag", recipe.id, ["Spicy"]));
    const spicy = (await addEntry("tag", householdId, "Spicy"))!.entry;
    const hot = (await addEntry("tag", householdId, "Hot"))!.entry;

    const settled = await raceBehind(holdRow(tags, spicy.id), [
      () => mergeEntries("tag", householdId, spicy, hot),
      () => moveToHouseholdOfOne(householdId, member.id),
    ]);

    expect(settled.map((one) => one.status)).toEqual(["fulfilled", "fulfilled"]);
    expect(await recipeEntryNames("tag", recipe.id)).toEqual(["Hot"]);
    await expectNothingForeign();
  });

  it.each(["leave first", "merge first"] as const)(
    "a housemate merging a food the leaver's line names: %s",
    async (order) => {
      const { member, householdId } = await sharedHousehold();
      const soja = await mintTestFood(householdId, "soja");
      const soy = await mintTestFood(householdId, "soy");
      const recipe = await createTestRecipe(member.id);
      const line = await insertTestRecipeLine({ recipeId: recipe.id, name: "soja" }, [
        soja.aliasId,
      ]);
      const leave = () => moveToHouseholdOfOne(householdId, member.id);
      const merge = () =>
        getTestDb().transaction((tx) =>
          mergeCatalogueIngredients(tx, soja.ingredientId, soy.ingredientId)
        );

      const settled = await raceBehind(
        holdRow(ingredients, soja.ingredientId),
        order === "leave first" ? [leave, merge] : [merge, leave]
      );

      expect(settled.map((one) => one.status)).toEqual(["fulfilled", "fulfilled"]);
      const [aliasId] = await testLineAliasIds(line.id);
      const [food] = await getTestDb()
        .select({ name: ingredients.name, householdId: ingredients.householdId })
        .from(ingredientAliases)
        .innerJoin(ingredients, eq(ingredients.id, ingredientAliases.ingredientId))
        .where(eq(ingredientAliases.id, aliasId!));

      // The leaver keeps what the line named when it left: the food, or the one it merged into.
      expect(food).toEqual({
        name: order === "leave first" ? "soja" : "soy",
        householdId: await householdOf(member.id),
      });
      expect(await readTestIngredient(soja.ingredientId)).toBeNull();
      await expectNothingForeign();
    }
  );

  it("two joins into one household both merge in, one after the other", async () => {
    const host = (await createTestUser())!;
    const first = (await createTestUser())!;
    const second = (await createTestUser())!;
    const into = await householdOf(host.id);

    for (const joiner of [first, second]) {
      const food = await mintTestFood(await householdOf(joiner.id), "ui");
      const recipe = await createTestRecipe(joiner.id);

      await insertTestRecipeLine({ recipeId: recipe.id, name: "ui" }, [food.aliasId]);
    }

    const settled = await raceBehind(holdRow(households, into), [
      () => joinHousehold(first.id, { householdId: into }),
      () => joinHousehold(second.id, { householdId: into }),
    ]);

    expect(settled).toEqual([
      fulfilled(expect.objectContaining({ joined: expect.anything() })),
      fulfilled(expect.objectContaining({ joined: expect.anything() })),
    ]);
    const uis = await getTestDb()
      .select({ id: ingredients.id })
      .from(ingredients)
      .where(eq(ingredients.householdId, into));

    expect(uis).toHaveLength(1);
    await expectNothingForeign();
  });

  it.each(["leave first", "deletion first"] as const)(
    "the leave and the deletion of the household's last other member: %s",
    async (order) => {
      const { admin, member, householdId } = await sharedHousehold();
      const food = await mintTestFood(householdId, "kimchi");
      const recipe = await createTestRecipe(member.id);
      const line = await insertTestRecipeLine({ recipeId: recipe.id, name: "kimchi" }, [
        food.aliasId,
      ]);

      await getTestDb().transaction((tx) => appendRecipeEntriesTx(tx, "tag", recipe.id, ["Spicy"]));
      const leave = () => moveToHouseholdOfOne(householdId, member.id);
      const erase = () => deleteAccount(admin.id);

      const settled = await raceBehind(
        holdRow(households, householdId),
        order === "leave first" ? [leave, erase] : [erase, leave]
      );

      if (order === "leave first") {
        expect(settled.map((one) => one.status)).toEqual(["fulfilled", "fulfilled"]);
      } else {
        // The admin's deletion hands the household to the member, who is then its last member.
        expect(settled[0]?.status).toBe("fulfilled");
        expect(settled[1]?.status).toBe("rejected");
      }
      expect((await testLineFoodNames(line.id)).map((one) => one.food)).toEqual(["kimchi"]);
      expect(await recipeEntryNames("tag", recipe.id)).toEqual(["Spicy"]);
      await expectNothingForeign();
    }
  );

  it("a housemate merging away the food a join merges into: the join takes the merged food", async () => {
    const host = (await createTestUser())!;
    const joiner = (await createTestUser())!;
    const into = await householdOf(host.id);
    const theirs = await mintTestFood(into, "ui");
    const onion = await mintTestFood(into, "onion");
    const mine = await mintTestFood(await householdOf(joiner.id), "ui");
    const recipe = await createTestRecipe(joiner.id);
    const line = await insertTestRecipeLine({ recipeId: recipe.id, name: "ui" }, [mine.aliasId]);

    const settled = await raceBehind(holdRow(ingredients, theirs.ingredientId), [
      () =>
        getTestDb().transaction((tx) =>
          mergeCatalogueIngredients(tx, theirs.ingredientId, onion.ingredientId)
        ),
      () => joinHousehold(joiner.id, { householdId: into }),
    ]);

    expect(settled).toEqual([
      fulfilled(true),
      fulfilled(expect.objectContaining({ leftHouseholdId: expect.any(String) })),
    ]);
    // "ui" is onion's spelling now, so the joiner's food merges into onion and its line takes it.
    expect(await testLineAliasIds(line.id)).toEqual([theirs.aliasId]);
    expect((await readTestSpelling(theirs.aliasId))?.ingredientId).toBe(onion.ingredientId);
    expect(await readTestIngredient(mine.ingredientId)).toBeNull();
    expect(await readTestIngredient(theirs.ingredientId)).toBeNull();
    await expectNothingForeign();
  });

  it("a housemate renaming a food to the joiner's food's name while the join waits", async () => {
    const host = (await createTestUser())!;
    const joiner = (await createTestUser())!;
    const into = await householdOf(host.id);
    const shallot = await mintTestFood(into, "sjalot");
    const mine = await mintTestFood(await householdOf(joiner.id), "ui");
    const recipe = await createTestRecipe(joiner.id);
    const line = await insertTestRecipeLine({ recipeId: recipe.id, name: "ui" }, [mine.aliasId]);
    let joined: Promise<unknown> | undefined;

    await getTestDb().transaction(async (tx) => {
      await holdRow(ingredients, mine.ingredientId)(tx);
      joined = joinHousehold(joiner.id, { householdId: into });
      joined.catch(() => undefined);
      await waitFor(
        async () => ((await lockWaits()).size > 0 ? true : undefined),
        "the join to wait on the joiner's food"
      );
      // Committed while the join waits: its first read named no food of that name.
      await setTestIngredients(shallot.ingredientId, { name: "ui" });
    });

    expect(await joined).toEqual(expect.objectContaining({ leftHouseholdId: expect.any(String) }));
    expect(await readTestIngredient(mine.ingredientId)).toBeNull();
    expect((await testLineFoodNames(line.id)).map((one) => one.food)).toEqual(["ui"]);
    expect((await readTestSpelling(mine.aliasId))?.ingredientId).toBe(shallot.ingredientId);
    await expectNothingForeign();
  });
});
