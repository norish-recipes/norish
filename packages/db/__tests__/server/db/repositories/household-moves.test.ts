// @vitest-environment node
/**
 * Leaving takes a member's recipes with what they carry of the household; joining from a
 * household of one merges it into the joined household (ADR-0041, 0042, 0043).
 */
import { and, eq, getTableColumns, is, isNotNull, ne, or } from "drizzle-orm";
import { alias, PgTable } from "drizzle-orm/pg-core";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { ServerConfigKeys } from "@norish/config/zod/server-config";
import { listGroceriesByHousehold } from "@norish/db/repositories/groceries";
import { mergeHouseholdRowsTx, mergeHouseholdTx } from "@norish/db/repositories/household-merge";
import {
  deleteAccount,
  getHouseholdIdForUser,
  joinHousehold,
  kickUserFromHousehold,
  moveToHouseholdOfOne,
} from "@norish/db/repositories/households";
import { listAIChanges } from "@norish/db/repositories/ingredient-ai-changes";
import { repointLines } from "@norish/db/repositories/ingredient-cleanup";
import { addToJunkPile, listJunkFolds } from "@norish/db/repositories/ingredient-junk-pile";
import { mergeCatalogueIngredients } from "@norish/db/repositories/ingredient-relocation";
import {
  addEntry,
  appendRecipeEntriesTx,
  deleteEntry,
  findOwnEntry,
  mergeEntries,
  recipeEntryNames,
  renameEntry,
} from "@norish/db/repositories/list-entries";
import { listPlannedItemsByHouseholdAndDateRange } from "@norish/db/repositories/planned-items";
import { saveRecipeNutritionEstimate } from "@norish/db/repositories/recipe-enrichment";
import { getRecipeFull } from "@norish/db/repositories/recipes";
import { deleteConfig, setConfig } from "@norish/db/repositories/server-config";
import * as schema from "@norish/db/schema";
import {
  aisleLinks,
  aisles,
  categories,
  cuisines,
  groceries,
  households,
  householdUsers,
  ingredientAIChanges,
  ingredientAliases,
  ingredientNutritionCorrections,
  ingredientNutritionEstimates,
  ingredients,
  ingredientStorePreferences,
  pantryIngredients,
  plannedItems,
  recipeCategories,
  recipeCuisines,
  recipeIngredientFoods,
  recipeIngredients,
  recipeNutritionEstimates,
  recipes,
  recipeTags,
  recurringGroceries,
  storeProductLinks,
  stores,
  tags,
} from "@norish/db/schema";
import { lineKey, nutritionLinesOf, workOutNutrition } from "@norish/shared/lib/recipe-nutrition";

import {
  addTestSpelling,
  createTestIngredient,
  createTestRecipe,
  createTestUser,
  getTestDb,
  insertTestRecipeLine,
  listTestAIChanges,
  mintTestFood,
  readTestIngredient,
  readTestSpelling,
  setTestIngredients,
  testLineAliasIds,
  testLineFoodNames,
} from "../../../helpers/db-test-helpers";
import { expectNothingForeign } from "../../../helpers/household-invariants";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

describe("household moves", () => {
  const testBase = new RepositoryTestBase("test_household_moves");

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
    const id = await getHouseholdIdForUser(userId);

    expect(id).not.toBeNull();

    return id!;
  }

  async function sharedHousehold() {
    const admin = await createTestUser();
    const member = await createTestUser();
    const householdId = await householdOf(admin.id);

    expect(await joinHousehold(member.id, { householdId })).toHaveProperty("joined");

    return { admin, member, householdId };
  }

  async function carry(kind: "tag" | "cuisine" | "category", recipeId: string, names: string[]) {
    await getTestDb().transaction((tx) => appendRecipeEntriesTx(tx, kind, recipeId, names));
  }

  async function entryOf(kind: "tag" | "cuisine" | "category", scope: string | null, name: string) {
    const added = await addEntry(kind, scope, name);

    return added!.entry;
  }

  /** A household Cuisine folding like an instance one, as only a pre-0.28 database holds, on `recipeId`. */
  async function householdTwinOn(householdId: string, recipeId: string, name: string) {
    const [twin] = await getTestDb()
      .insert(cuisines)
      .values({ householdId, name: name.toLowerCase(), nameFold: name.toLowerCase() })
      .returning({ id: cuisines.id });

    await getTestDb().insert(recipeCuisines).values({ recipeId, cuisineId: twin!.id, order: 0 });
  }

  const cuisineRowsOf = async (recipeId: string) =>
    await getTestDb()
      .select({ name: cuisines.name, householdId: cuisines.householdId })
      .from(recipeCuisines)
      .innerJoin(cuisines, eq(cuisines.id, recipeCuisines.cuisineId))
      .where(eq(recipeCuisines.recipeId, recipeId));

  describe("leaving keeps the recipes' lists", () => {
    it.each(["leave", "remove"] as const)(
      "%s: the household's entries become the new household's, the instance's stay",
      async (how) => {
        const { admin, member, householdId } = await sharedHousehold();
        const leaving = await createTestRecipe(member.id, { name: "Curry" });
        const staying = await createTestRecipe(admin.id, { name: "Stew" });
        const italian = await entryOf("cuisine", null, "Italian");

        await carry("tag", leaving.id, ["Spicy", "BBQ"]);
        await carry("tag", staying.id, ["spicy"]);
        await carry("category", leaving.id, ["Weeknight", "Dinner"]);
        await carry("cuisine", leaving.id, ["Fusion", "Italian"]);

        const moved =
          how === "leave"
            ? await moveToHouseholdOfOne(householdId, member.id)
            : await kickUserFromHousehold(householdId, member.id, admin.id);
        const newHousehold = moved.applied ? moved.value.household.id : "";

        expect(await recipeEntryNames("tag", leaving.id)).toEqual(["Spicy", "BBQ"]);
        expect(await recipeEntryNames("category", leaving.id)).toEqual(["Weeknight", "Dinner"]);
        expect(await recipeEntryNames("cuisine", leaving.id)).toEqual(["Fusion", "Italian"]);
        expect(await recipeEntryNames("tag", staying.id)).toEqual(["Spicy"]);

        const cuisinesCarried = await getTestDb()
          .select({ id: cuisines.id, householdId: cuisines.householdId })
          .from(recipeCuisines)
          .innerJoin(cuisines, eq(cuisines.id, recipeCuisines.cuisineId))
          .where(eq(recipeCuisines.recipeId, leaving.id));

        expect(cuisinesCarried).toEqual(
          expect.arrayContaining([
            { id: italian.id, householdId: null },
            { id: expect.any(String), householdId: newHousehold },
          ])
        );
        // The old household keeps its entries, each on its own recipes only.
        const oldTags = await getTestDb()
          .select({ name: tags.name })
          .from(tags)
          .where(eq(tags.householdId, householdId));

        expect(oldTags.map((row) => row.name).sort()).toEqual(["BBQ", "Spicy"]);
        await expectNothingForeign();
      }
    );

    it("maps a carried entry folding like an instance entry onto it, copying no twin", async () => {
      const { member, householdId } = await sharedHousehold();
      const leaving = await createTestRecipe(member.id, { name: "Larb" });

      await entryOf("cuisine", null, "Luang");
      await householdTwinOn(householdId, leaving.id, "Luang");
      const moved = await moveToHouseholdOfOne(householdId, member.id);
      const newHousehold = moved.applied ? moved.value.household.id : "";

      expect(await cuisineRowsOf(leaving.id)).toEqual([{ name: "Luang", householdId: null }]);
      expect(
        await getTestDb().select().from(cuisines).where(eq(cuisines.householdId, newHousehold))
      ).toEqual([]);
    });

    it("the old household's rename, merge and delete no longer reach the leaver's recipes", async () => {
      const { admin, member, householdId } = await sharedHousehold();
      const leaving = await createTestRecipe(member.id);

      await carry("tag", leaving.id, ["Spicy", "Quick", "Hot"]);
      const spicy = await entryOf("tag", householdId, "Spicy");
      const quick = await entryOf("tag", householdId, "Quick");
      const hot = await entryOf("tag", householdId, "Hot");

      await moveToHouseholdOfOne(householdId, member.id);

      expect(await renameEntry("tag", householdId, spicy, "Mild")).toMatchObject({ applied: true });
      expect(
        await mergeEntries(
          "tag",
          householdId,
          hot,
          (await findOwnEntry("tag", householdId, spicy.id))!
        )
      ).toMatchObject({ applied: true });
      expect(await deleteEntry("tag", householdId, quick)).toEqual({
        applied: true,
        stale: false,
        value: { detached: 0 },
      });
      expect(await recipeEntryNames("tag", leaving.id)).toEqual(["Spicy", "Quick", "Hot"]);
      void admin;
    });

    it("deleting the old household's last member leaves the leaver's entries", async () => {
      const { admin, member, householdId } = await sharedHousehold();
      const leaving = await createTestRecipe(member.id);

      await carry("tag", leaving.id, ["Spicy"]);
      await carry("category", leaving.id, ["Weeknight"]);
      await moveToHouseholdOfOne(householdId, member.id);
      await deleteAccount(admin.id);

      expect(await recipeEntryNames("tag", leaving.id)).toEqual(["Spicy"]);
      expect(await recipeEntryNames("category", leaving.id)).toEqual(["Weeknight"]);
      await expectNothingForeign();
    });
  });
  async function getRecipeIngredientRows(recipeId: string) {
    const rows = await getTestDb()
      .select({ id: recipeIngredients.id })
      .from(recipeIngredients)
      .where(eq(recipeIngredients.recipeId, recipeId));

    return rows.map((row) => row.id);
  }

  /** What a line's first food is: its spelling's household and text, the food's row. */
  async function lineFood(lineId: string) {
    const [aliasId] = await testLineAliasIds(lineId);
    const [spelling] = await getTestDb()
      .select()
      .from(ingredientAliases)
      .where(eq(ingredientAliases.id, aliasId!));

    return { spelling: spelling!, food: (await readTestIngredient(spelling!.ingredientId))! };
  }

  async function sharesOf(recipeId: string) {
    const [row] = await getTestDb()
      .select({ lines: recipeNutritionEstimates.lines })
      .from(recipeNutritionEstimates)
      .where(eq(recipeNutritionEstimates.recipeId, recipeId));

    return row?.lines.map((line) => line.key) ?? [];
  }

  /** The calories the recipe's stored shares bring, every line left out. */
  async function sharedCalories(recipeId: string) {
    const recipe = (await getRecipeFull(recipeId))!;
    const worked = workOutNutrition({
      lines: nutritionLinesOf(recipe, {}),
      servings: 1,
      nutrition: new Map(),
      seasoning: [],
      estimate: recipe.nutritionEstimate,
    });

    return worked.perServing?.calories;
  }

  describe("leaving keeps the recipes' foods", () => {
    async function leaverWithFoods() {
      const { admin, member, householdId } = await sharedHousehold();
      const soy = (await createTestIngredient({ name: "soy sauce" }))!;
      const cabbage = (await createTestIngredient({ name: "cabbage" }))!;
      const paste = await mintTestFood(householdId, "paste");
      const gochujang = await mintTestFood(householdId, "gochujang");
      const kimchi = await mintTestFood(householdId, "kimchi");
      const soja = await addTestSpelling(soy.id, "soja", { householdId });
      const seedSoy = (
        await testLineAliasIds(
          (
            await insertTestRecipeLine(
              { recipeId: (await createTestRecipe(admin.id)).id, name: "soy" },
              [
                (
                  await getTestDb()
                    .select({ id: ingredientAliases.id })
                    .from(ingredientAliases)
                    .where(eq(ingredientAliases.ingredientId, soy.id))
                )[0]!.id,
              ]
            )
          ).id
        )
      )[0]!;

      await setTestIngredients(gochujang.ingredientId, {
        parentId: paste.ingredientId,
        icon: "abc.webp",
        flagged: true,
      });
      await setTestIngredients(kimchi.ingredientId, { parentId: cabbage.id });

      const recipe = await createTestRecipe(member.id, { name: "Bibimbap" });
      const line = (name: string, aliasId: string) =>
        insertTestRecipeLine({ recipeId: recipe.id, name, amount: "2", unit: "tbsp" }, [aliasId]);
      const lines = {
        gochujang: await line("gochujang", gochujang.aliasId),
        soja: await line("soja", soja),
        soy: await line("soy sauce", seedSoy),
        kimchi: await line("kimchi", kimchi.aliasId),
        paste: await line("paste", paste.aliasId),
      };
      const housemates = await createTestRecipe(admin.id);
      const theirs = await insertTestRecipeLine({ recipeId: housemates.id, name: "gochujang" }, [
        gochujang.aliasId,
      ]);
      const share = lineKey({
        name: "gochujang",
        amount: 2,
        unit: "tbsp",
        ingredientId: gochujang.ingredientId,
      });

      await saveRecipeNutritionEstimate(recipe.id, {
        lines: [{ key: share, calories: 10, fat: 1, carbs: 1, protein: 1 }],
      });

      return {
        admin,
        member,
        householdId,
        recipe,
        lines,
        theirs,
        soy,
        cabbage,
        gochujang,
        seedSoy,
      };
    }

    it("copies each household food with its spellings, icon and parent, and re-points the lines", async () => {
      const { member, householdId, recipe, lines, theirs, soy, cabbage, gochujang, seedSoy } =
        await leaverWithFoods();
      const moved = await moveToHouseholdOfOne(householdId, member.id);
      const home = moved.applied ? moved.value.household.id : "";

      const copied = await lineFood(lines.gochujang.id);

      expect(copied.spelling).toMatchObject({ householdId: home, text: "gochujang" });
      expect(copied.food).toMatchObject({
        householdId: home,
        name: "gochujang",
        icon: "abc.webp",
        flagged: true,
        ownerId: null,
      });
      expect(copied.food.id).not.toBe(gochujang.ingredientId);
      // An own parent goes as its copy where the lines use it; a seeded one stays.
      expect(copied.food.parentId).toBe((await lineFood(lines.paste.id)).food.id);
      expect((await lineFood(lines.paste.id)).food.householdId).toBe(home);
      expect((await lineFood(lines.kimchi.id)).food).toMatchObject({
        householdId: home,
        parentId: cabbage.id,
      });
      // The household's spelling on a seeded food becomes the new household's, on that food.
      expect((await lineFood(lines.soja.id)).spelling).toMatchObject({
        householdId: home,
        ingredientId: soy.id,
      });
      expect(await testLineAliasIds(lines.soy.id)).toEqual([seedSoy]);
      // The old household keeps its own; a housemate's line still names it.
      expect(await testLineAliasIds(theirs.id)).toEqual([gochujang.aliasId]);
      expect((await readTestIngredient(gochujang.ingredientId))?.householdId).toBe(householdId);
      expect(await sharesOf(recipe.id)).toEqual([
        lineKey({ name: "gochujang", amount: 2, unit: "tbsp", ingredientId: copied.food.id }),
      ]);
      await expectNothingForeign();
    });

    it("files a copy under the nearest seeded ancestor where its own parent stays behind", async () => {
      const { member, householdId } = await sharedHousehold();
      const pepper = (await createTestIngredient({ name: "pepper" }))!;
      const chili = await mintTestFood(householdId, "chili");
      const gochugaru = await mintTestFood(householdId, "gochugaru");

      await setTestIngredients(chili.ingredientId, { parentId: pepper.id });
      await setTestIngredients(gochugaru.ingredientId, { parentId: chili.ingredientId });
      const recipe = await createTestRecipe(member.id);
      const line = await insertTestRecipeLine({ recipeId: recipe.id, name: "gochugaru" }, [
        gochugaru.aliasId,
      ]);

      await moveToHouseholdOfOne(householdId, member.id);

      expect((await lineFood(line.id)).food).toMatchObject({
        householdId: await householdOf(member.id),
        name: "gochugaru",
        parentId: pepper.id,
      });
      await expectNothingForeign();
    });

    it("deleting the old household's last member leaves the leaver's lines whole", async () => {
      const { admin, member, householdId, recipe, lines } = await leaverWithFoods();

      await kickUserFromHousehold(householdId, member.id, admin.id);
      const before = await Promise.all(Object.values(lines).map((one) => testLineAliasIds(one.id)));
      const shares = await sharesOf(recipe.id);

      await deleteAccount(admin.id);

      expect(
        await Promise.all(Object.values(lines).map((one) => testLineAliasIds(one.id)))
      ).toEqual(before);
      expect(await sharesOf(recipe.id)).toEqual(shares);
      await expectNothingForeign();
    });

    it("an estimate read before the leave is saved under the lines' foods at the save", async () => {
      const { member, householdId } = await sharedHousehold();
      const kimchi = await mintTestFood(householdId, "kimchi");
      const recipe = await createTestRecipe(member.id);
      const line = await insertTestRecipeLine(
        { recipeId: recipe.id, name: "kimchi", amount: "1", unit: null },
        [kimchi.aliasId]
      );
      const key = (ingredientId: string) =>
        lineKey({ name: "kimchi", amount: 1, unit: null, ingredientId });

      await moveToHouseholdOfOne(householdId, member.id);
      await saveRecipeNutritionEstimate(
        recipe.id,
        {
          lines: [
            {
              lineId: line.id,
              key: key(kimchi.ingredientId),
              calories: 4,
              fat: 0,
              carbs: 0,
              protein: 0,
            },
          ],
        },
        new Map([[line.id, [kimchi.ingredientId]]])
      );

      expect(await sharesOf(recipe.id)).toEqual([key((await lineFood(line.id)).food.id)]);
    });

    it("a merge meeting two lines' shares keeps the recipe's shared total", async () => {
      const user = await createTestUser();
      const householdId = await householdOf(user.id);
      const soja = await mintTestFood(householdId, "soja");
      const soy = await mintTestFood(householdId, "soy");
      const recipe = await createTestRecipe(user.id);
      const share = (name: string, ingredientId: string, calories: number) => ({
        key: lineKey({ name, amount: 1, unit: null, ingredientId }),
        calories,
        fat: 0,
        carbs: 0,
        protein: 0,
      });

      for (const [name, food] of [
        ["soja", soja],
        ["soy", soy],
      ] as const) {
        await insertTestRecipeLine({ recipeId: recipe.id, name, amount: "1", unit: null }, [
          food.aliasId,
        ]);
      }
      await saveRecipeNutritionEstimate(recipe.id, {
        lines: [share("soja", soja.ingredientId, 5), share("soy", soy.ingredientId, 7)],
      });
      expect(await sharedCalories(recipe.id)).toBe(12);

      await getTestDb().transaction((tx) =>
        mergeCatalogueIngredients(tx, soja.ingredientId, soy.ingredientId)
      );

      // Both lines now read one key; its combined share counts once.
      expect(await sharesOf(recipe.id)).toEqual([share("soy", soy.ingredientId, 0).key]);
      expect(await sharedCalories(recipe.id)).toBe(12);
    });

    it("an estimate's save keys each share by its own line's foods", async () => {
      const user = await createTestUser();
      const householdId = await householdOf(user.id);
      const [kool, spitskool, rodekool] = await Promise.all(
        ["kool", "spitskool", "rodekool"].map((name) => mintTestFood(householdId, name))
      );
      const recipe = await createTestRecipe(user.id);
      const [first, second] = await Promise.all(
        ["1", "2"].map((amount) =>
          insertTestRecipeLine({ recipeId: recipe.id, name: "kool", amount, unit: null }, [
            kool!.aliasId,
          ])
        )
      );
      const key = (amount: number, ingredientId: string) =>
        lineKey({ name: "kool", amount, unit: null, ingredientId });

      // Read with "kool" on both lines; each line takes another food before the save.
      await getTestDb().transaction((tx) =>
        repointLines(tx, [
          { id: first!.id, aliasIds: [spitskool!.aliasId], joined: null },
          { id: second!.id, aliasIds: [rodekool!.aliasId], joined: null },
        ])
      );
      await saveRecipeNutritionEstimate(
        recipe.id,
        {
          lines: [
            {
              lineId: first!.id,
              key: key(1, kool!.ingredientId),
              calories: 3,
              fat: 0,
              carbs: 0,
              protein: 0,
            },
            {
              lineId: second!.id,
              key: key(2, kool!.ingredientId),
              calories: 4,
              fat: 0,
              carbs: 0,
              protein: 0,
            },
          ],
        },
        new Map([
          [first!.id, [kool!.ingredientId]],
          [second!.id, [kool!.ingredientId]],
        ])
      );

      expect((await sharesOf(recipe.id)).sort()).toEqual(
        [key(1, spitskool!.ingredientId), key(2, rodekool!.ingredientId)].sort()
      );
      expect(await sharedCalories(recipe.id)).toBe(7);
    });

    it("a merge keys the AI's share again for the merged line", async () => {
      const user = await createTestUser();
      const householdId = await householdOf(user.id);
      const soja = await mintTestFood(householdId, "soja");
      const soy = await mintTestFood(householdId, "soy");
      const recipe = await createTestRecipe(user.id);

      await insertTestRecipeLine({ recipeId: recipe.id, name: "soja", amount: "1", unit: null }, [
        soja.aliasId,
      ]);
      await saveRecipeNutritionEstimate(recipe.id, {
        lines: [
          {
            key: lineKey({ name: "soja", amount: 1, unit: null, ingredientId: soja.ingredientId }),
            calories: 5,
            fat: 0,
            carbs: 0,
            protein: 0,
          },
        ],
      });
      await getTestDb().transaction((tx) =>
        mergeCatalogueIngredients(tx, soja.ingredientId, soy.ingredientId)
      );

      expect(await sharesOf(recipe.id)).toEqual([
        lineKey({ name: "soja", amount: 1, unit: null, ingredientId: soy.ingredientId }),
      ]);
    });
  });
  /** One of each household-owned row, for `userId`'s household; the Pantry, correction and store
   * preference are for `food`. */
  async function householdRows(userId: string, food: string, store: string) {
    const db = getTestDb();
    const householdId = await householdOf(userId);
    const [shop] = await db.insert(stores).values({ householdId, userId, name: store }).returning();
    const [aisle] = await db
      .insert(aisles)
      .values({ storeId: shop!.id, name: "Dairy" })
      .returning();

    await db
      .insert(aisleLinks)
      .values({ storeId: shop!.id, aisleId: aisle!.id, ingredientId: food });
    const [grocery] = await db
      .insert(groceries)
      .values({ householdId, userId, name: `${store} grocery`, storeId: shop!.id })
      .returning();
    const [recurring] = await db
      .insert(recurringGroceries)
      .values({
        householdId,
        userId,
        name: `${store} bread`,
        recurrenceRule: "week",
        nextPlannedFor: "2027-01-01",
      })
      .returning();
    const [pantry] = await db
      .insert(pantryIngredients)
      .values({ householdId, userId, ingredientId: food })
      .returning();
    const [correction] = await db
      .insert(ingredientNutritionCorrections)
      .values({ householdId, userId, ingredientId: food, kcal: 1, fat: 1, carbs: 1, protein: 1 })
      .returning();
    const [preference] = await db
      .insert(ingredientStorePreferences)
      .values({ householdId, userId, ingredientId: food, storeId: shop!.id })
      .returning();
    const [plan] = await db
      .insert(plannedItems)
      .values({
        householdId,
        userId,
        date: "2027-01-02",
        slot: "Dinner",
        itemType: "note",
        title: store,
      })
      .returning();

    return {
      householdId,
      shop: shop!,
      grocery: grocery!,
      recurring: recurring!,
      pantry: pantry!,
      correction: correction!,
      preference: preference!,
      plan: plan!,
    };
  }

  async function idsIn(
    table:
      | typeof pantryIngredients
      | typeof ingredientNutritionCorrections
      | typeof ingredientStorePreferences
      | typeof groceries
      | typeof recurringGroceries
      | typeof plannedItems
      | typeof stores,
    householdId: string
  ) {
    const rows = await getTestDb()
      .select({ id: table.id })
      .from(table)
      .where(eq(table.householdId, householdId));

    return rows.map((row) => row.id).sort();
  }

  describe("joining moves the household's rows", () => {
    it("moves Stores, groceries and plans; for one food, the joined household's row stays", async () => {
      const host = (await createTestUser())!;
      const joiner = (await createTestUser())!;
      const milk = (await createTestIngredient({ name: "milk" }))!;
      const butter = (await createTestIngredient({ name: "butter" }))!;
      const theirs = await householdRows(host.id, milk.id, "Market");
      const mine = await householdRows(joiner.id, milk.id, "Corner shop");
      const [butterPantry] = await getTestDb()
        .insert(pantryIngredients)
        .values({ householdId: mine.householdId, userId: joiner.id, ingredientId: butter.id })
        .returning();

      await getTestDb().transaction((tx) =>
        mergeHouseholdRowsTx(tx, mine.householdId, theirs.householdId)
      );

      const into = theirs.householdId;

      expect(await idsIn(stores, into)).toEqual([theirs.shop.id, mine.shop.id].sort());
      expect(await idsIn(groceries, into)).toEqual([theirs.grocery.id, mine.grocery.id].sort());
      expect(await idsIn(recurringGroceries, into)).toEqual(
        [theirs.recurring.id, mine.recurring.id].sort()
      );
      expect(await idsIn(plannedItems, into)).toEqual([theirs.plan.id, mine.plan.id].sort());
      expect(await idsIn(pantryIngredients, into)).toEqual(
        [theirs.pantry.id, butterPantry!.id].sort()
      );
      expect(await idsIn(ingredientNutritionCorrections, into)).toEqual([theirs.correction.id]);
      expect(await idsIn(ingredientStorePreferences, into)).toEqual([theirs.preference.id]);
      // The joiner's Stores keep their aisles and links, and come after the household's.
      const [moved] = await getTestDb().select().from(stores).where(eq(stores.id, mine.shop.id));

      expect(moved!.sortOrder).toBeGreaterThan(theirs.shop.sortOrder);
      expect(
        await getTestDb()
          .select({ id: aisleLinks.id })
          .from(aisleLinks)
          .where(eq(aisleLinks.storeId, mine.shop.id))
      ).toHaveLength(1);
    });
  });
  /** What a join does in its transaction: the membership moves (the triggers take the recipes),
   * the household merges, the emptied one goes. */
  async function mergeInto(joinerId: string, into: string) {
    const from = await householdOf(joinerId);

    await getTestDb().transaction(async (tx) => {
      await tx
        .update(householdUsers)
        .set({ householdId: into })
        .where(eq(householdUsers.userId, joinerId));
      await mergeHouseholdTx(tx, from, into);
      await tx.delete(households).where(eq(households.id, from));
    });

    return from;
  }

  describe("joining merges the household of one", () => {
    it("merges 'soja' and 'ui' into the household's foods", async () => {
      const host = (await createTestUser())!;
      const joiner = (await createTestUser())!;
      const into = await householdOf(host.id);
      const own = await householdOf(joiner.id);
      const sojasaus = await mintTestFood(into, "sojasaus");
      const theirSoja = await addTestSpelling(sojasaus.ingredientId, "soja");
      const theirUi = await mintTestFood(into, "ui");
      const mySoja = await mintTestFood(own, "soja");
      const myUi = await mintTestFood(own, "ui");
      const myLeek = await mintTestFood(own, "prei");

      await addTestSpelling(myUi.ingredientId, "uien");
      const recipe = await createTestRecipe(joiner.id);
      const soja = await insertTestRecipeLine({ recipeId: recipe.id, name: "soja", amount: "1" }, [
        mySoja.aliasId,
      ]);
      const ui = await insertTestRecipeLine({ recipeId: recipe.id, name: "ui" }, [myUi.aliasId]);
      const leek = await insertTestRecipeLine({ recipeId: recipe.id, name: "prei" }, [
        myLeek.aliasId,
      ]);
      const pantry = (
        food: { ingredientId: string; aliasId: string },
        householdId: string,
        userId: string
      ) =>
        getTestDb()
          .insert(pantryIngredients)
          .values({
            householdId,
            userId,
            ingredientId: food.ingredientId,
            ingredientAliasId: food.aliasId,
          })
          .returning();
      const [theirPantryUi] = await pantry(theirUi, into, host.id);

      await pantry(myUi, own, joiner.id);
      await pantry(mySoja, own, joiner.id);
      await saveRecipeNutritionEstimate(recipe.id, {
        lines: [
          {
            key: lineKey({
              name: "soja",
              amount: 1,
              unit: null,
              ingredientId: mySoja.ingredientId,
            }),
            calories: 3,
            fat: 0,
            carbs: 0,
            protein: 0,
          },
        ],
      });

      await mergeInto(joiner.id, into);

      expect(await testLineAliasIds(soja.id)).toEqual([theirSoja]);
      expect(await testLineAliasIds(ui.id)).toEqual([theirUi.aliasId]);
      // Own foods the household has no name or spelling of move as they are.
      expect(await testLineAliasIds(leek.id)).toEqual([myLeek.aliasId]);
      expect((await readTestIngredient(myLeek.ingredientId))?.householdId).toBe(into);
      expect(await readTestIngredient(mySoja.ingredientId)).toBeNull();
      expect(await readTestIngredient(myUi.ingredientId)).toBeNull();
      // The joiner's other spelling of "ui" is the household's food's now.
      const [uien] = await getTestDb()
        .select()
        .from(ingredientAliases)
        .where(and(eq(ingredientAliases.fold, "uien"), eq(ingredientAliases.householdId, into)));

      expect(uien?.ingredientId).toBe(theirUi.ingredientId);
      // Pantry duplicates of one food go, the household's stays.
      const pantryRows = await getTestDb()
        .select()
        .from(pantryIngredients)
        .where(eq(pantryIngredients.householdId, into));

      expect(pantryRows.map((row) => row.ingredientId).sort()).toEqual(
        [sojasaus.ingredientId, theirUi.ingredientId].sort()
      );
      expect(pantryRows.map((row) => row.id)).toContain(theirPantryUi!.id);
      expect(await sharesOf(recipe.id)).toEqual([
        lineKey({ name: "soja", amount: 1, unit: null, ingredientId: sojasaus.ingredientId }),
      ]);
      await expectNothingForeign();
    });

    it("maps a joiner entry folding like an instance entry onto it, copying no twin", async () => {
      const host = (await createTestUser())!;
      const joiner = (await createTestUser())!;
      const into = await householdOf(host.id);
      const mine = await createTestRecipe(joiner.id);

      await entryOf("cuisine", null, "Isan");
      await householdTwinOn(await householdOf(joiner.id), mine.id, "Isan");
      await mergeInto(joiner.id, into);

      expect(await cuisineRowsOf(mine.id)).toEqual([{ name: "Isan", householdId: null }]);
      expect(
        await getTestDb().select().from(cuisines).where(eq(cuisines.householdId, into))
      ).toEqual([]);
    });

    it("joins Tags, Cuisines and Categories of a fold to the household's entry", async () => {
      const host = (await createTestUser())!;
      const joiner = (await createTestUser())!;
      const into = await householdOf(host.id);
      const theirs = await createTestRecipe(host.id);
      const mine = await createTestRecipe(joiner.id);

      await carry("tag", theirs.id, ["Spicy"]);
      await carry("tag", mine.id, ["spicy", "Vegan"]);
      await carry("cuisine", mine.id, ["Fusion"]);
      await carry("category", mine.id, ["Weeknight"]);
      const spicy = await entryOf("tag", into, "Spicy");
      const from = await mergeInto(joiner.id, into);

      expect(await recipeEntryNames("tag", mine.id)).toEqual(["Spicy", "Vegan"]);
      expect(await recipeEntryNames("cuisine", mine.id)).toEqual(["Fusion"]);
      expect(await recipeEntryNames("category", mine.id)).toEqual(["Weeknight"]);
      expect((await findOwnEntry("tag", into, spicy.id))?.name).toBe("Spicy");
      const intoTags = await getTestDb()
        .select({ name: tags.name })
        .from(tags)
        .where(eq(tags.householdId, into));

      expect(intoTags.map((row) => row.name).sort()).toEqual(["Spicy", "Vegan"]);
      expect(await getTestDb().select().from(tags).where(eq(tags.householdId, from))).toEqual([]);
      await expectNothingForeign();
    });

    it("gives a joiner food one target: every row of every spelling lands on the food of its name", async () => {
      const host = (await createTestUser())!;
      const joiner = (await createTestUser())!;
      const into = await householdOf(host.id);
      const own = await householdOf(joiner.id);
      const db = getTestDb();
      const named = await mintTestFood(into, "tomaat");
      const spelled = await mintTestFood(into, "paradijsappel");
      const theirTomato = await addTestSpelling(spelled.ingredientId, "tomato");
      const mine = await mintTestFood(own, "tomaat");
      const myTomato = await addTestSpelling(mine.ingredientId, "tomato");
      const food = mine.ingredientId;
      const recipe = await createTestRecipe(joiner.id);
      const byName = await insertTestRecipeLine({ recipeId: recipe.id, name: "tomaat" }, [
        mine.aliasId,
      ]);
      const bySpelling = await insertTestRecipeLine({ recipeId: recipe.id, name: "tomato" }, [
        myTomato,
      ]);
      const rows = await householdRows(joiner.id, food, "Corner shop");

      await db
        .update(groceries)
        .set({ ingredientId: food, ingredientAliasId: myTomato })
        .where(eq(groceries.id, rows.grocery.id));
      await db
        .update(recurringGroceries)
        .set({ ingredientId: food, ingredientAliasId: myTomato })
        .where(eq(recurringGroceries.id, rows.recurring.id));
      await db
        .update(pantryIngredients)
        .set({ ingredientAliasId: myTomato })
        .where(eq(pantryIngredients.id, rows.pantry.id));
      // The household keeps the other food in its Pantry, which must not swallow the joiner's.
      await db
        .insert(pantryIngredients)
        .values({ householdId: into, userId: host.id, ingredientId: spelled.ingredientId });
      const [link] = await db
        .insert(storeProductLinks)
        .values({ storeId: rows.shop.id, ingredientId: food })
        .returning();
      await db.insert(ingredientNutritionEstimates).values({ ingredientId: food, kcal: 18 });
      await setTestIngredients(food, { flagged: true, flagReason: "ai-unsure" });

      await mergeInto(joiner.id, into);

      const target = named.ingredientId;
      const onTarget = async (
        table:
          | typeof groceries
          | typeof recurringGroceries
          | typeof pantryIngredients
          | typeof ingredientNutritionCorrections
          | typeof ingredientStorePreferences
          | typeof aisleLinks
          | typeof storeProductLinks,
        id: string
      ) => (await db.select().from(table).where(eq(table.id, id)))[0]?.ingredientId;

      expect(await readTestIngredient(food)).toBeNull();
      expect(await testLineAliasIds(byName.id)).toEqual([named.aliasId]);
      // The household's "tomato" stays on its own food; the joiner's line takes the target's spelling.
      expect(await testLineAliasIds(bySpelling.id)).toEqual([named.aliasId]);
      expect((await readTestSpelling(theirTomato))?.ingredientId).toBe(spelled.ingredientId);
      for (const [table, id] of [
        [groceries, rows.grocery.id],
        [recurringGroceries, rows.recurring.id],
        [pantryIngredients, rows.pantry.id],
        [ingredientNutritionCorrections, rows.correction.id],
        [ingredientStorePreferences, rows.preference.id],
        [storeProductLinks, link!.id],
      ] as const) {
        expect(await onTarget(table, id)).toBe(target);
      }
      const [grocery] = await db.select().from(groceries).where(eq(groceries.id, rows.grocery.id));

      expect(grocery?.ingredientAliasId).toBe(named.aliasId);
      expect(
        (
          await db
            .select({ ingredientId: aisleLinks.ingredientId })
            .from(aisleLinks)
            .where(eq(aisleLinks.storeId, rows.shop.id))
        ).map((row) => row.ingredientId)
      ).toEqual([target]);
      expect(
        await db
          .select({ kcal: ingredientNutritionEstimates.kcal })
          .from(ingredientNutritionEstimates)
          .where(eq(ingredientNutritionEstimates.ingredientId, target))
      ).toEqual([{ kcal: 18 }]);
      expect(await readTestIngredient(target)).toMatchObject({
        flagged: true,
        flagReason: "ai-unsure",
      });
      await expectNothingForeign();
    });

    it("keeps what a colliding food knows that the household's lacks", async () => {
      const host = (await createTestUser())!;
      const joiner = (await createTestUser())!;
      const into = await householdOf(host.id);
      const own = await householdOf(joiner.id);
      const db = getTestDb();
      const theirs = await mintTestFood(into, "prei");
      const mine = await mintTestFood(own, "prei");
      const parent = await mintTestFood(own, "groente");
      const food = mine.ingredientId;
      const rows = await householdRows(joiner.id, food, "Corner shop");

      await db
        .update(ingredientNutritionCorrections)
        .set({ kcal: 30, density: 0.4, pieceWeight: 150 })
        .where(eq(ingredientNutritionCorrections.id, rows.correction.id));
      const [theirCorrection] = await db
        .insert(ingredientNutritionCorrections)
        .values({
          householdId: into,
          userId: host.id,
          ingredientId: theirs.ingredientId,
          kcal: 31,
          fat: 0,
          carbs: 7,
          protein: 1,
        })
        .returning();
      await db.insert(ingredientNutritionEstimates).values({ ingredientId: food, kcal: 25 });
      const change = (kind: string, undo: Record<string, unknown>) =>
        db
          .insert(ingredientAIChanges)
          .values({
            kind,
            householdId: own,
            ingredientId: food,
            sure: true,
            undo: undo as typeof ingredientAIChanges.$inferInsert.undo,
          })
          .returning({ id: ingredientAIChanges.id });
      const [parentChange] = await change("parent", {
        kind: "parent",
        formerParentId: parent.ingredientId,
      });
      const [renamed] = await change("plain-name", {
        kind: "plain-name",
        formerName: "PREI",
        name: "prei",
      });
      const [merged] = await change("merge", {
        kind: "merge",
        name: "porree",
        ownerId: null,
        aliasIds: [mine.aliasId],
        parentId: null,
      });

      // Not AI's doubt, which a stranded change would no longer hold up.
      await setTestIngredients(food, { flagged: true, flagReason: "seed-ambiguous" });
      await mergeInto(joiner.id, into);

      const changes = new Map((await listTestAIChanges()).map((row) => [row.id, row]));

      // Every change is the household's food's now; those whose Undo no longer applies are stranded.
      for (const id of [parentChange!.id, renamed!.id, merged!.id]) {
        expect(changes.get(id)).toMatchObject({
          ingredientId: theirs.ingredientId,
          householdId: into,
        });
      }
      expect(changes.get(parentChange!.id)?.undo.stranded).toBe(true);
      expect(changes.get(renamed!.id)?.undo.stranded).toBe(true);
      // The merge's spelling joined the household's own "prei" and is gone.
      expect(changes.get(merged!.id)?.undo.stranded).toBe(true);
      expect(
        await db
          .select({ kcal: ingredientNutritionEstimates.kcal })
          .from(ingredientNutritionEstimates)
          .where(eq(ingredientNutritionEstimates.ingredientId, theirs.ingredientId))
      ).toEqual([{ kcal: 25 }]);
      expect(await readTestIngredient(theirs.ingredientId)).toMatchObject({ flagged: true });
      // The household's correction wins field by field; what it leaves empty comes from the joiner's.
      const corrections = await db
        .select()
        .from(ingredientNutritionCorrections)
        .where(eq(ingredientNutritionCorrections.householdId, into));

      expect(corrections).toHaveLength(1);
      expect(corrections[0]).toMatchObject({
        id: theirCorrection!.id,
        kcal: 31,
        carbs: 7,
        density: 0.4,
        pieceWeight: 150,
      });
      // With no preference of its own for the food, the household takes the joiner's.
      expect(
        await db
          .select({ id: ingredientStorePreferences.id })
          .from(ingredientStorePreferences)
          .where(eq(ingredientStorePreferences.ingredientId, theirs.ingredientId))
      ).toEqual([{ id: rows.preference.id }]);
      await expectNothingForeign();
    });

    it("settles a stranded unsure change: history only, flagging nothing", async () => {
      const host = (await createTestUser())!;
      const joiner = (await createTestUser())!;
      const into = await householdOf(host.id);
      const own = await householdOf(joiner.id);
      const db = getTestDb();
      const theirs = await mintTestFood(into, "prei");
      const mine = await mintTestFood(own, "prei");
      const parent = await mintTestFood(own, "groente");
      const [doubted] = await db
        .insert(ingredientAIChanges)
        .values({
          kind: "parent",
          householdId: own,
          ingredientId: mine.ingredientId,
          sure: false,
          undo: { kind: "parent", formerParentId: parent.ingredientId },
        })
        .returning({ id: ingredientAIChanges.id });

      await setTestIngredients(mine.ingredientId, { flagged: true, flagReason: "ai-unsure" });
      await mergeInto(joiner.id, into);

      const listed = await listAIChanges({ householdId: into, isServerAdmin: false });
      const change = listed.find((one) => one.id === doubted!.id);

      // Listed as history: neither waiting on a person nor keeping the food flagged.
      expect(change).toMatchObject({ sure: true, kept: false, undo: { stranded: true } });
      expect(change?.ingredient?.id).toBe(theirs.ingredientId);
      expect(await readTestIngredient(theirs.ingredientId)).toMatchObject({
        flagged: false,
        flagReason: null,
      });
      await expectNothingForeign();
    });

    it("merges a joiner food into a seeded target without writing the seeded row", async () => {
      const host = (await createTestUser())!;
      const joiner = (await createTestUser())!;
      const into = await householdOf(host.id);
      const own = await householdOf(joiner.id);
      const db = getTestDb();
      const seeded = (await createTestIngredient({ name: "lente-ui" }))!;
      const theirSpelling = await addTestSpelling(seeded.id, "bosui", { householdId: into });
      const mine = await mintTestFood(own, "bosui");
      const recipe = await createTestRecipe(joiner.id);
      const line = await insertTestRecipeLine({ recipeId: recipe.id, name: "bosui" }, [
        mine.aliasId,
      ]);
      const [doubted] = await db
        .insert(ingredientAIChanges)
        .values({
          kind: "plain-name",
          householdId: own,
          ingredientId: mine.ingredientId,
          sure: false,
          undo: { kind: "plain-name", formerName: "Bosui", name: "bosui" },
        })
        .returning({ id: ingredientAIChanges.id });

      await db
        .insert(ingredientNutritionEstimates)
        .values({ ingredientId: mine.ingredientId, kcal: 32 });
      await setTestIngredients(mine.ingredientId, { flagged: true, flagReason: "ai-unsure" });
      const before = await readTestIngredient(seeded.id);

      await mergeInto(joiner.id, into);

      expect(await readTestIngredient(seeded.id)).toEqual(before);
      expect(await readTestIngredient(mine.ingredientId)).toBeNull();
      expect(await testLineAliasIds(line.id)).toEqual([theirSpelling]);
      // The estimate and the flag were the joiner food's alone: a seeded food takes neither.
      expect(
        await db
          .select()
          .from(ingredientNutritionEstimates)
          .where(eq(ingredientNutritionEstimates.ingredientId, seeded.id))
      ).toEqual([]);
      // Its AI Change follows onto the seeded food as the household's settled history.
      expect((await listTestAIChanges()).find((one) => one.id === doubted!.id)).toMatchObject({
        ingredientId: seeded.id,
        householdId: into,
        sure: true,
        undo: { stranded: true },
      });
      await expectNothingForeign();
    });

    it("merges a joiner food and its joiner child that both collide", async () => {
      const host = (await createTestUser())!;
      const joiner = (await createTestUser())!;
      const into = await householdOf(host.id);
      const own = await householdOf(joiner.id);
      const theirVeg = await mintTestFood(into, "groente");
      const theirLeek = await mintTestFood(into, "prei");
      const myVeg = await mintTestFood(own, "groente");
      const myLeek = await mintTestFood(own, "prei", { parentId: myVeg.ingredientId });

      // The child first, while its parent is still the joiner's.
      await setTestIngredients(myLeek.ingredientId, { createdAt: new Date("2020-01-01") });
      await setTestIngredients(myVeg.ingredientId, { createdAt: new Date("2021-01-01") });
      const recipe = await createTestRecipe(joiner.id);
      const veg = await insertTestRecipeLine({ recipeId: recipe.id, name: "groente" }, [
        myVeg.aliasId,
      ]);
      const leek = await insertTestRecipeLine({ recipeId: recipe.id, name: "prei" }, [
        myLeek.aliasId,
      ]);

      await mergeInto(joiner.id, into);

      expect(await readTestIngredient(myVeg.ingredientId)).toBeNull();
      expect(await readTestIngredient(myLeek.ingredientId)).toBeNull();
      expect(await testLineAliasIds(veg.id)).toEqual([theirVeg.aliasId]);
      expect(await testLineAliasIds(leek.id)).toEqual([theirLeek.aliasId]);
      // The household's own leek keeps the parent it had.
      expect((await readTestIngredient(theirLeek.ingredientId))?.parentId).toBeNull();
      await expectNothingForeign();
    });

    it("merges several joiner foods into one target: the household's first, then oldest food first", async () => {
      const host = (await createTestUser())!;
      const joiner = (await createTestUser())!;
      const into = await householdOf(host.id);
      const own = await householdOf(joiner.id);
      const db = getTestDb();
      const target = await mintTestFood(into, "tomaat");

      await addTestSpelling(target.ingredientId, "tomato");
      // The newer food is minted first, so neither id nor insert order makes the older one win.
      const newer = await mintTestFood(own, "pomodoro");
      const older = await mintTestFood(own, "tomaat");

      await addTestSpelling(newer.ingredientId, "tomato");
      await setTestIngredients(older.ingredientId, { createdAt: new Date("2020-01-01") });
      await setTestIngredients(newer.ingredientId, { createdAt: new Date("2021-01-01") });
      await db.insert(ingredientNutritionCorrections).values([
        {
          householdId: into,
          ingredientId: target.ingredientId,
          kcal: 18,
          fat: 0,
          carbs: 4,
          protein: 1,
        },
        { householdId: own, ingredientId: older.ingredientId, kcal: 99, density: 0.5 },
        { householdId: own, ingredientId: newer.ingredientId, density: 0.9, pieceWeight: 120 },
      ]);
      await db.insert(ingredientNutritionEstimates).values([
        { ingredientId: newer.ingredientId, kcal: 20 },
        { ingredientId: older.ingredientId, kcal: 10 },
      ]);
      await setTestIngredients(newer.ingredientId, { flagged: true, flagReason: "food-gone" });
      await setTestIngredients(older.ingredientId, { flagged: true, flagReason: "ai-unsure" });

      await mergeInto(joiner.id, into);

      expect(await readTestIngredient(older.ingredientId)).toBeNull();
      expect(await readTestIngredient(newer.ingredientId)).toBeNull();
      const corrections = await db
        .select()
        .from(ingredientNutritionCorrections)
        .where(eq(ingredientNutritionCorrections.ingredientId, target.ingredientId));

      // The numbers are the household's; the density the older food's; the piece weight the newer's.
      expect(corrections).toHaveLength(1);
      expect(corrections[0]).toMatchObject({
        householdId: into,
        kcal: 18,
        carbs: 4,
        density: 0.5,
        pieceWeight: 120,
      });
      expect(
        await db
          .select({ kcal: ingredientNutritionEstimates.kcal })
          .from(ingredientNutritionEstimates)
          .where(eq(ingredientNutritionEstimates.ingredientId, target.ingredientId))
      ).toEqual([{ kcal: 10 }]);
      expect(await readTestIngredient(target.ingredientId)).toMatchObject({
        flagged: true,
        flagReason: "ai-unsure",
      });
      await expectNothingForeign();
    });

    it("keeps the household's junk mark of a fold both hold and takes the joiner's others", async () => {
      const host = (await createTestUser())!;
      const joiner = (await createTestUser())!;
      const into = await householdOf(host.id);
      const own = await householdOf(joiner.id);

      await addToJunkPile(getTestDb(), into, ["fresh"], { reason: "person" });
      await addToJunkPile(getTestDb(), own, ["fresh", "chopped"], { reason: "person" });
      await mergeInto(joiner.id, into);

      expect(
        (await listJunkFolds(into)).filter((fold) => ["fresh", "chopped"].includes(fold)).sort()
      ).toEqual(["chopped", "fresh"]);
    });
  });
  describe("leaving under view Household", () => {
    afterEach(async () => {
      await deleteConfig(ServerConfigKeys.RECIPE_PERMISSION_POLICY);
    });

    it("the leaver keeps their recipe whole; the household plans and lists it by title only", async () => {
      await setConfig(
        ServerConfigKeys.RECIPE_PERMISSION_POLICY,
        { view: "household", edit: "household", delete: "household" },
        null,
        false
      );
      const { admin, member, householdId } = await sharedHousehold();
      const gochujang = await mintTestFood(householdId, "gochujang");
      const recipe = await createTestRecipe(member.id, { name: "Bibimbap" });
      const line = await insertTestRecipeLine({ recipeId: recipe.id, name: "gochujang" }, [
        gochujang.aliasId,
      ]);

      await carry("tag", recipe.id, ["Spicy"]);
      await getTestDb().insert(plannedItems).values({
        householdId,
        userId: admin.id,
        date: "2027-01-02",
        slot: "Dinner",
        itemType: "recipe",
        recipeId: recipe.id,
      });
      await getTestDb()
        .insert(groceries)
        .values({ householdId, userId: admin.id, name: "gochujang", recipeIngredientId: line.id });

      await moveToHouseholdOfOne(householdId, member.id);

      expect((await testLineFoodNames(line.id)).map((one) => one.food)).toEqual(["gochujang"]);
      expect(await recipeEntryNames("tag", recipe.id)).toEqual(["Spicy"]);
      expect(
        await listPlannedItemsByHouseholdAndDateRange(householdId, "2027-01-01", "2027-01-31")
      ).toEqual([expect.objectContaining({ recipeId: null, recipeName: "Bibimbap" })]);
      expect(await listGroceriesByHousehold(householdId)).toEqual([
        expect.objectContaining({ name: "gochujang", recipeIngredientId: null }),
      ]);
      // The leaver's new household plans and lists nothing of the old one.
      expect(
        await listPlannedItemsByHouseholdAndDateRange(
          await householdOf(member.id),
          "2027-01-01",
          "2027-01-31"
        )
      ).toEqual([]);
    });
  });

  it("keeps both invariants after every membership operation", async () => {
    const admin = (await createTestUser())!;
    const householdId = await householdOf(admin.id);
    const people = await Promise.all([1, 2, 3, 4].map(async () => (await createTestUser())!));
    const [leaver, removed, claimer, deleted] = people as [
      (typeof people)[number],
      (typeof people)[number],
      (typeof people)[number],
      (typeof people)[number],
    ];

    /** A recipe with a Tag and a line on the account's household's own food. */
    const furnish = async (userId: string, word: string) => {
      const food = await mintTestFood(await householdOf(userId), word);
      const recipe = await createTestRecipe(userId);

      await insertTestRecipeLine({ recipeId: recipe.id, name: word }, [food.aliasId]);
      await carry("tag", recipe.id, [word, "Shared"]);
    };

    await furnish(admin.id, "ui");
    for (const person of people) {
      await furnish(person.id, "ui");
      // Joining merges what each brings: the first time, by fold and name.
      expect(await joinHousehold(person.id, { householdId })).toHaveProperty("joined");
      await expectNothingForeign();
      await furnish(person.id, `own ${person.id}`);
    }
    await moveToHouseholdOfOne(householdId, leaver.id);
    await expectNothingForeign();
    await kickUserFromHousehold(householdId, removed.id, admin.id);
    await expectNothingForeign();
    await moveToHouseholdOfOne(householdId, claimer.id);
    // The OIDC claim places an account alone in its household by name, through the join.
    await getTestDb()
      .update(households)
      .set({ name: "The Smiths" })
      .where(eq(households.id, householdId));
    expect(await joinHousehold(claimer.id, { householdId, name: "the smiths" })).toHaveProperty(
      "joined"
    );
    await expectNothingForeign();
    await deleteAccount(deleted.id);
    await expectNothingForeign();
    await deleteAccount(admin.id);
    await expectNothingForeign();
  });

  describe("what a join does to each household table", () => {
    /** Every table with a `household_id`, from the schema: a table added later is checked too. */
    const householdTables = Object.entries(schema).flatMap(([name, value]) =>
      is(value, PgTable) && "householdId" in getTableColumns(value)
        ? [{ name, table: value as PgTable & { householdId: typeof tags.householdId } }]
        : []
    );

    async function countsIn(householdId: string) {
      const counts: Record<string, number> = {};

      for (const { name, table } of householdTables) {
        counts[name] = (
          await getTestDb()
            .select({ id: table.householdId })
            .from(table)
            .where(eq(table.householdId, householdId))
        ).length;
      }

      return counts;
    }

    it("moves, merges or drops every row, and leaves the old household's id nowhere", async () => {
      const host = (await createTestUser())!;
      const joiner = (await createTestUser())!;
      const into = await householdOf(host.id);
      const from = await householdOf(joiner.id);
      const milk = (await createTestIngredient({ name: "milk" }))!;

      await householdRows(host.id, milk.id, "Market");
      await householdRows(joiner.id, milk.id, "Corner shop");
      const theirUi = await mintTestFood(into, "ui");
      const myUi = await mintTestFood(from, "ui");
      const myLeek = await mintTestFood(from, "prei");

      await addToJunkPile(getTestDb(), into, ["fresh"], { reason: "person" });
      await addToJunkPile(getTestDb(), from, ["fresh", "chopped"], { reason: "person" });
      await getTestDb()
        .insert(schema.ingredientAIChanges)
        .values({
          kind: "parent",
          householdId: from,
          ingredientId: myLeek.ingredientId,
          sure: true,
          undo: { kind: "parent", formerParentId: null },
        });
      const theirs = await createTestRecipe(host.id);
      const mine = await createTestRecipe(joiner.id);

      await insertTestRecipeLine({ recipeId: theirs.id, name: "ui" }, [theirUi.aliasId]);
      await insertTestRecipeLine({ recipeId: mine.id, name: "ui" }, [myUi.aliasId]);
      for (const recipe of [theirs, mine]) {
        await carry("tag", recipe.id, ["Spicy"]);
        await carry("cuisine", recipe.id, ["Fusion"]);
        await carry("category", recipe.id, ["Weeknight"]);
      }
      await carry("tag", mine.id, ["Vegan"]);
      await getTestDb().insert(schema.cookbooks).values({ userId: joiner.id, title: "Mine" });

      const before = { into: await countsIn(into), from: await countsIn(from) };

      // A new household table fails here until the join says what happens to its rows.
      expect(householdTables.map(({ name }) => name).sort()).toEqual([
        "categories",
        "cookbooks",
        "cuisines",
        "groceries",
        "householdUsers",
        "ingredientAIChanges",
        "ingredientAliases",
        "ingredientJunkPile",
        "ingredientNutritionCorrections",
        "ingredientStorePreferences",
        "ingredients",
        "pantryIngredients",
        "plannedItems",
        "recipes",
        "recurringGroceries",
        "stores",
        "tags",
      ]);

      // The fixture holds a row of the joiner's in every household table.
      for (const { name } of householdTables)
        expect([name, before.from[name]]).not.toEqual([name, 0]);
      expect(await joinHousehold(joiner.id, { householdId: into })).toHaveProperty("joined");

      const after = { into: await countsIn(into), from: await countsIn(from) };
      // What a join drops: the joiner's row of what the household already holds one of.
      const dropped: Record<string, number> = {
        pantryIngredients: 1,
        ingredientNutritionCorrections: 1,
        ingredientStorePreferences: 1,
        ingredientJunkPile: 1,
        tags: 1,
        cuisines: 1,
        categories: 1,
        ingredients: 1,
        ingredientAliases: 1,
      };

      for (const { name } of householdTables) {
        expect([name, after.from[name]]).toEqual([name, 0]);
        expect([name, after.into[name]]).toEqual([
          name,
          before.into[name]! + before.from[name]! - (dropped[name] ?? 0),
        ]);
      }
      expect(await testLineAliasIds((await getRecipeIngredientRows(mine.id))[0]!)).toEqual([
        theirUi.aliasId,
      ]);
      await expectNothingForeign();
    });
  });
});
