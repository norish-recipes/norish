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
import { listRecipeLinesWithoutAlias } from "@norish/db/repositories/ingredient-aliases";
import { listPantryIngredientsByUserIds } from "@norish/db/repositories/pantry";
import { ingredients, pantryIngredients, recipeIngredients } from "@norish/db/schema";
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
});
