// @vitest-environment node
/**
 * Leaving takes a member's recipes with what they carry of the household; joining from a
 * household of one merges it into the joined household (ADR-0041, 0042, 0043).
 */
import { and, eq, isNotNull, ne, or } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { mergeHouseholdTx, moveHouseholdRowsTx } from "@norish/db/repositories/household-merge";
import {
  deleteAccount,
  getHouseholdIdForUser,
  joinHousehold,
  kickUserFromHousehold,
  moveToHouseholdOfOne,
} from "@norish/db/repositories/households";
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
import { saveRecipeNutritionEstimate } from "@norish/db/repositories/recipe-enrichment";
import {
  aisleLinks,
  aisles,
  categories,
  cuisines,
  groceries,
  households,
  householdUsers,
  ingredientAliases,
  ingredientNutritionCorrections,
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
  stores,
  tags,
} from "@norish/db/schema";
import { lineKey } from "@norish/shared/lib/recipe-nutrition";

import {
  addTestSpelling,
  createTestIngredient,
  createTestRecipe,
  createTestUser,
  getTestDb,
  insertTestRecipeLine,
  mintTestFood,
  readTestIngredient,
  setTestIngredients,
  testLineAliasIds,
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
        moveHouseholdRowsTx(tx, mine.householdId, theirs.householdId)
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
});
