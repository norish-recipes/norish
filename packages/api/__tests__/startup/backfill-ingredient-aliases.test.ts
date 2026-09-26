// @vitest-environment node
/**
 * The upgrade to Ingredient Aliases (ADR-0037), against a real database: an
 * instance's existing ingredients and the lines, pantry rows and groceries
 * pointing at them are carried over so resolution finds what the household
 * already had, and nothing it taught Norish is lost.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { backfillIngredientAliases } from "@norish/api/startup/backfill-ingredient-aliases";
import { getRecipeFull } from "@norish/db";
import { listAisleLinksByStoreIds } from "@norish/db/repositories/aisles";
import {
  listGroceriesWithoutAlias,
  listRecipeLinesWithoutAlias,
  listRecurringGroceriesWithoutAlias,
} from "@norish/db/repositories/ingredient-aliases";
import { listPantryIngredientsByUserIds } from "@norish/db/repositories/pantry";
import { resolveProductLinks } from "@norish/db/repositories/store-products";
import { findBestIngredientStorePreference } from "@norish/db/repositories/stores";
import {
  aisleLinks,
  aisles,
  groceries,
  ingredients,
  ingredientStorePreferences,
  pantryIngredients,
  recipeIngredients,
  recurringGroceries,
  storeProductLinks,
  stores,
} from "@norish/db/schema";
import { resolveIngredients } from "@norish/shared-server/ingredients/resolver";
import { pantryIngredientFor } from "@norish/shared/lib/pantry";

import { getTestDb } from "../../../db/__tests__/helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../db/__tests__/helpers/repository-test-base";

describe("backfillIngredientAliases", () => {
  const testBase = new RepositoryTestBase("test_backfill_ingredient_aliases");

  let userId: string;
  let recipeId: string;

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    const [user, recipe] = await testBase.beforeEachTest();

    userId = user.id;
    recipeId = recipe.id;
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  /** An ingredient and a line as the schema migration leaves them: no alias yet. */
  async function legacyIngredient(name: string, createdAt: Date) {
    const db = getTestDb();
    const [row] = await db.insert(ingredients).values({ name, createdAt }).returning();

    await db
      .insert(recipeIngredients)
      .values({ recipeId, ingredientId: row!.id, name, order: "0", systemUsed: "metric" });

    return row!;
  }

  it("resolves an existing ingredient's name to it rather than minting another", async () => {
    const olive = await legacyIngredient("Olive Oil", new Date("2025-01-01"));

    await backfillIngredientAliases();

    const [resolved] = await resolveIngredients(["olive oil"], { userId });

    expect(resolved!.ingredientId).toBe(olive.id);
  });

  it("gives names that fold alike to the ingredient that had the spelling first", async () => {
    const older = await legacyIngredient("Crème fraîche", new Date("2025-01-01"));

    await legacyIngredient("creme fraiche", new Date("2025-06-01"));

    await backfillIngredientAliases();

    const [resolved] = await resolveIngredients(["Creme Fraiche"], { userId });

    expect(resolved!.ingredientId).toBe(older.id);
  });

  it("points every existing recipe line at an alias", async () => {
    await legacyIngredient("Olive Oil", new Date("2025-01-01"));
    await legacyIngredient("olive oil!", new Date("2025-06-01"));

    await backfillIngredientAliases();

    await expect(listRecipeLinesWithoutAlias(10)).resolves.toEqual([]);
  });

  it("keeps every Pantry Ingredient, and it covers the recipe lines of its food", async () => {
    const older = await legacyIngredient("Crème fraîche", new Date("2025-01-01"));
    const [twin] = await getTestDb()
      .insert(ingredients)
      .values({ name: "creme fraiche", createdAt: new Date("2025-06-01") })
      .returning();

    await getTestDb().insert(pantryIngredients).values({ userId, ingredientId: twin!.id });

    await backfillIngredientAliases();

    const pantry = await listPantryIngredientsByUserIds([userId]);
    const [line] = (await getRecipeFull(recipeId))!.recipeIngredients;

    expect(pantry).toHaveLength(1);
    expect(pantry[0]!.ingredientId).toBe(older.id);
    expect(pantryIngredientFor(pantry, line!)).not.toBeNull();
  });

  it("resolves every grocery and recurring grocery, and leaves the text on the list alone", async () => {
    await legacyIngredient("Olive Oil", new Date("2025-01-01"));
    await getTestDb()
      .insert(groceries)
      .values([
        { userId, name: "olive oil!" },
        { userId, name: "Uien" },
        { userId, name: null },
      ]);
    await getTestDb().insert(recurringGroceries).values({
      userId,
      name: "Melk",
      recurrenceRule: "week",
      nextPlannedFor: "2025-12-01",
    });

    await backfillIngredientAliases();

    // A line with no name names no food, and has nothing to resolve.
    await expect(listGroceriesWithoutAlias(10)).resolves.toEqual([]);
    await expect(listRecurringGroceriesWithoutAlias(10)).resolves.toEqual([]);

    const names = await getTestDb().select({ name: groceries.name }).from(groceries);

    expect(names.map((row) => row.name).sort()).toEqual(["Uien", "olive oil!", null].sort());
  });

  describe("links keyed by a folded name", () => {
    async function store(name: string) {
      const [row] = await getTestDb().insert(stores).values({ userId, name }).returning();
      const [aisle] = await getTestDb()
        .insert(aisles)
        .values({ storeId: row!.id, name: "Groente" })
        .returning();

      return { storeId: row!.id, aisleId: aisle!.id };
    }

    it("carries each link over to the Ingredient its grocery resolved to", async () => {
      const { storeId, aisleId } = await store("AH");

      await legacyIngredient("onions", new Date("2025-01-01"));
      await getTestDb().insert(groceries).values({ userId, name: "Onions, diced", storeId });
      await getTestDb()
        .insert(aisleLinks)
        .values({ storeId, normalizedName: "onions diced", aisleId });
      await getTestDb().insert(ingredientStorePreferences).values({
        userId,
        normalizedName: "onions, diced",
        storeId,
      });

      await backfillIngredientAliases();

      const [onions] = await resolveIngredients(["onions"], { userId });

      await expect(listAisleLinksByStoreIds([storeId])).resolves.toEqual([
        { storeId, ingredientId: onions!.ingredientId, aisleId },
      ]);
      await expect(
        findBestIngredientStorePreference(userId, [userId], {
          id: onions!.ingredientId,
          name: "onions",
        })
      ).resolves.toMatchObject({ isExactMatch: true, preference: { storeId } });
    });

    it("keeps the most recently updated of two links that land on one Ingredient", async () => {
      const { storeId, aisleId: groente } = await store("Jumbo");
      const [fruit] = await getTestDb()
        .insert(aisles)
        .values({ storeId, name: "Fruit" })
        .returning();

      await legacyIngredient("apples", new Date("2025-01-01"));
      await getTestDb()
        .insert(groceries)
        .values([
          { userId, name: "apples", storeId },
          { userId, name: "apples, sliced", storeId },
        ]);
      await getTestDb()
        .insert(aisleLinks)
        .values([
          {
            storeId,
            normalizedName: "apples",
            aisleId: groente,
            updatedAt: new Date("2025-01-01"),
          },
          {
            storeId,
            normalizedName: "apples sliced",
            aisleId: fruit!.id,
            updatedAt: new Date("2025-06-01"),
          },
        ]);

      await backfillIngredientAliases();

      await expect(listAisleLinksByStoreIds([storeId])).resolves.toEqual([
        expect.objectContaining({ aisleId: fruit!.id }),
      ]);
    });

    it("mints an Ingredient for a folded name nothing else knows, so no link is dropped", async () => {
      const { storeId } = await store("Dirk");

      await getTestDb()
        .insert(storeProductLinks)
        .values({ storeId, normalizedName: "havermelk", triedAt: new Date() });

      await backfillIngredientAliases();

      const [havermelk] = await resolveIngredients(["Havermelk"], { userId });

      await expect(
        resolveProductLinks([{ storeId, ingredientId: havermelk!.ingredientId }])
      ).resolves.toHaveLength(1);
    });
  });
});
