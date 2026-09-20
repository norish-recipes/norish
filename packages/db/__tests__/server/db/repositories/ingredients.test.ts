// @vitest-environment node

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@norish/db/drizzle";
import {
  attachIngredientsToRecipeByInputTx,
  getOrCreateIngredientByName,
  getOrCreateManyIngredients,
} from "@norish/db/repositories/ingredients";

import { createTestRecipe, createTestUser } from "../../../helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

const testBase = new RepositoryTestBase("test_ingredients");
let testRecipe: Awaited<ReturnType<typeof createTestRecipe>>;
let user: Awaited<ReturnType<typeof createTestUser>>;

describe("Ingredients Repository", () => {
  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    const [createdUser, recipe] = await testBase.beforeEachTest();
    user = createdUser;
    testRecipe = recipe;
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  it("updates ingredient casing if requested with a different casing via getOrCreateIngredientByName", async () => {
    // Create with lowercase
    const ingredient1 = await getOrCreateIngredientByName("mascarpone");
    expect(ingredient1.name).toBe("mascarpone");

    // Request with uppercase
    const ingredient2 = await getOrCreateIngredientByName("Mascarpone");

    // Should have same ID but updated name
    expect(ingredient2.id).toBe(ingredient1.id);
    expect(ingredient2.name).toBe("Mascarpone");

    // Request with mixed case
    const ingredient3 = await getOrCreateIngredientByName("MascarPONE");
    expect(ingredient3.id).toBe(ingredient1.id);
    expect(ingredient3.name).toBe("MascarPONE");
  });

  it("updates ingredient casing if requested with a different casing via getOrCreateManyIngredients", async () => {
    // Create with lowercase
    const ingredients1 = await getOrCreateManyIngredients(["onions", "garlic"]);
    expect(ingredients1.map((i) => i.name)).toEqual(expect.arrayContaining(["onions", "garlic"]));

    // Request with uppercase
    const ingredients2 = await getOrCreateManyIngredients(["Onions", "Garlic"]);

    expect(ingredients2.map((i) => i.name)).toEqual(expect.arrayContaining(["Onions", "Garlic"]));
  });

  it("updates ingredient casing if requested with a different casing when attaching to recipe", async () => {
    const secondRecipe = await createTestRecipe(user.id, { name: "Recipe 2" });

    // Create a recipe ingredient with lowercase
    const attached1 = await db.transaction(async (tx) => {
      return await attachIngredientsToRecipeByInputTx(tx, [
        { recipeId: testRecipe.id, ingredientName: "tomatoes", order: 0 },
      ]);
    });

    expect(attached1[0].ingredientName).toBe("tomatoes");

    // Attach to a second recipe but use uppercase
    const attached2 = await db.transaction(async (tx) => {
      return await attachIngredientsToRecipeByInputTx(tx, [
        { recipeId: secondRecipe.id, ingredientName: "Tomatoes", order: 0 },
      ]);
    });

    // The returned ingredient should have the updated casing
    expect(attached2[0].ingredientName).toBe("Tomatoes");
  });
});
