// @vitest-environment node
/**
 * The upgrade to Ingredient Aliases (ADR-0037), against a real database. It
 * runs after the first seed, so the lines, pantry rows and groceries that
 * pointed at an instance's old ingredients are resolved from their text as a
 * new import would be, AI aside; the old rows are no foods of their own, and
 * nothing the household taught Norish is lost.
 */
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { SeedEntry } from "@norish/db/repositories/ingredient-seed";
import { backfillIngredientAliases } from "@norish/api/startup/backfill-ingredient-aliases";
import { getRecipeFull } from "@norish/db";
import { listAisleLinksByStoreIds } from "@norish/db/repositories/aisles";
import {
  listGroceriesWithoutAlias,
  listRecipeLinesWithoutAlias,
  listRecurringGroceriesWithoutAlias,
} from "@norish/db/repositories/ingredient-backfill";
import {
  applyIngredientSeed,
  listSeededIngredientIds,
} from "@norish/db/repositories/ingredient-seed";
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
import { ingredientAliasFold } from "@norish/shared/lib/spelling-keys";

import { getTestDb } from "../../../db/__tests__/helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../db/__tests__/helpers/repository-test-base";

function entry(offId: string, ...names: string[]): SeedEntry {
  return {
    offId,
    name: names[0]!,
    nameFold: ingredientAliasFold(names[0]!),
    parentOffId: null,
    nutrition: null,
    aliases: names.map((text) => ({ text, fold: ingredientAliasFold(text), locale: null })),
  };
}

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

    await db.insert(recipeIngredients).values({ recipeId, name, order: "0", systemUsed: "metric" });

    return row!;
  }

  /** The Ingredient each of the recipe's lines points at, by the line's text. */
  async function linesOfRecipe() {
    const lines = (await getRecipeFull(recipeId))!.recipeIngredients;

    return new Map(lines.map((line) => [line.ingredientName, line.ingredientId]));
  }

  async function ingredientById(id: string) {
    const [row] = await getTestDb()
      .select({
        name: ingredients.name,
        flagged: ingredients.flagged,
        flagReason: ingredients.flagReason,
        parentId: ingredients.parentId,
      })
      .from(ingredients)
      .where(eq(ingredients.id, id));

    return row ?? null;
  }

  it("resolves an old line to the seeded food its text names", async () => {
    await applyIngredientSeed([entry("en:garlic", "garlic", "knoflook")]);
    await legacyIngredient("knoflook (fijngehakt)", new Date("2025-01-01"));

    await backfillIngredientAliases();

    const garlic = (await listSeededIngredientIds()).get("en:garlic");

    expect((await linesOfRecipe()).get("knoflook (fijngehakt)")).toBe(garlic);
  });

  it("mints a name the catalogue does not know as a new import would: flagged, plain, filed", async () => {
    await applyIngredientSeed([entry("en:courgette", "courgette")]);
    await legacyIngredient("gegrilde courgette, in plakjes", new Date("2025-01-01"));
    await legacyIngredient("kleine courgette, in kleine blokjes", new Date("2025-01-01"));

    await backfillIngredientAliases();

    const lines = await linesOfRecipe();
    const courgette = (await listSeededIngredientIds()).get("en:courgette");

    await expect(ingredientById(lines.get("gegrilde courgette, in plakjes")!)).resolves.toEqual({
      name: "gegrilde courgette",
      flagged: true,
      flagReason: "upgrade",
      parentId: courgette,
    });
    // A size is no part of the food: a small courgette is courgette.
    expect(lines.get("kleine courgette, in kleine blokjes")).toBe(courgette);
  });

  it("gives lines that name one food the one Ingredient, with no seed at all", async () => {
    await legacyIngredient("Crème fraîche", new Date("2025-01-01"));
    await legacyIngredient("creme fraiche, cold", new Date("2025-06-01"));

    await backfillIngredientAliases();

    const lines = await linesOfRecipe();

    expect(lines.get("Crème fraîche")).toBeTruthy();
    expect(lines.get("creme fraiche, cold")).toBe(lines.get("Crème fraîche"));
  });

  it("leaves a heading without an alias, as naming no food", async () => {
    await applyIngredientSeed([entry("en:sauce", "sauce")]);
    await legacyIngredient("# Sauce", new Date("2025-01-01"));

    await backfillIngredientAliases();

    expect((await linesOfRecipe()).get("# Sauce")).toBeNull();
    await expect(listRecipeLinesWithoutAlias(10)).resolves.toEqual([]);
    await expect(
      getTestDb().select().from(ingredients).where(eq(ingredients.name, "# Sauce"))
    ).resolves.toEqual([]);
  });

  it("keeps an old row the seed adopted by its name, under the seed's name", async () => {
    const salt = await legacyIngredient("Salt", new Date("2025-01-01"));

    // At boot the seed comes first, and takes the row that holds its name.
    await applyIngredientSeed([entry("en:salt", "salt", "zout")]);
    await backfillIngredientAliases();

    expect((await linesOfRecipe()).get("Salt")).toBe(salt.id);
    await expect(ingredientById(salt.id)).resolves.toMatchObject({ name: "salt", flagged: false });
  });

  it("mints into an old row that holds the plain name, flag and all", async () => {
    const olive = await legacyIngredient("Olive Oil", new Date("2025-01-01"));

    await backfillIngredientAliases();

    expect((await linesOfRecipe()).get("Olive Oil")).toBe(olive.id);
    await expect(ingredientById(olive.id)).resolves.toMatchObject({
      name: "Olive Oil",
      flagged: true,
      flagReason: "upgrade",
    });
  });

  it("removes the old rows nothing points at any more", async () => {
    await legacyIngredient("kleine courgette, in kleine blokjes", new Date("2025-01-01"));
    const [orphan] = await getTestDb()
      .insert(ingredients)
      .values({ name: "from a deleted recipe" })
      .returning();

    await backfillIngredientAliases();

    await expect(
      getTestDb()
        .select({ name: ingredients.name })
        .from(ingredients)
        .where(inArray(ingredients.name, ["kleine courgette, in kleine blokjes", orphan!.name]))
    ).resolves.toEqual([]);
  });

  it("points every existing recipe line at an alias", async () => {
    await legacyIngredient("Olive Oil", new Date("2025-01-01"));
    await legacyIngredient("olive oil!", new Date("2025-06-01"));

    await backfillIngredientAliases();

    await expect(listRecipeLinesWithoutAlias(10)).resolves.toEqual([]);
  });

  it("keeps every Pantry Ingredient, and it covers the recipe lines of its food", async () => {
    await legacyIngredient("Crème fraîche", new Date("2025-01-01"));
    const [twin] = await getTestDb()
      .insert(ingredients)
      .values({ name: "creme fraiche", createdAt: new Date("2025-06-01") })
      .returning();

    await getTestDb().insert(pantryIngredients).values({ userId, ingredientId: twin!.id });

    await backfillIngredientAliases();

    const pantry = await listPantryIngredientsByUserIds([userId]);
    const [line] = (await getRecipeFull(recipeId))!.recipeIngredients;

    expect(pantry).toHaveLength(1);
    expect(pantry[0]!.ingredientId).toBe(line!.ingredientId);
    expect(pantryIngredientFor(pantry, line!)).not.toBeNull();
  });

  it("passes over a grocery whose name is markup alone, and resolves the rest", async () => {
    await getTestDb()
      .insert(groceries)
      .values([
        { userId, name: "<b></b>" },
        { userId, name: "Uien" },
      ]);

    await backfillIngredientAliases();

    await expect(listGroceriesWithoutAlias(10)).resolves.toEqual([
      expect.objectContaining({ name: "<b></b>" }),
    ]);
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

    it("drops a link whose name is markup alone, and carries the rest over", async () => {
      const { storeId } = await store("Lidl");

      await getTestDb()
        .insert(storeProductLinks)
        .values([
          { storeId, normalizedName: "<br>", triedAt: new Date("2025-06-01") },
          { storeId, normalizedName: "yoghurt", triedAt: new Date("2025-01-01") },
        ]);

      await backfillIngredientAliases();

      const [yoghurt] = await resolveIngredients(["yoghurt"], { userId });

      await expect(
        resolveProductLinks([{ storeId, ingredientId: yoghurt!.ingredientId }])
      ).resolves.toHaveLength(1);
      await expect(getTestDb().select().from(storeProductLinks)).resolves.toHaveLength(1);
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
