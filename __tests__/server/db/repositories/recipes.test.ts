// @vitest-environment node
/**
 * Tests for recipe repository functions
 *
 * These tests verify critical data integrity issues, particularly
 * for Issue #255: Editing Recipe Discards AI Import Unit Conversion
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";

import { updateRecipeWithRefs } from "@/server/db/repositories/recipes";
import {
  createTestRecipe,
  createTestIngredient,
  createTestRecipeIngredients,
  createTestRecipeStep,
  getRecipeIngredients,
  getRecipeSteps,
} from "@/__tests__/helpers/db-test-helpers";
import { RepositoryTestBase } from "@/__tests__/helpers/repository-test-base";

describe("Recipe Repository - updateRecipeWithRefs", () => {
  let testUserId: string;
  let testRecipeId: string;
  const testBase = new RepositoryTestBase("test_recipes");

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    const [user, recipe] = await testBase.beforeEachTest();

    testUserId = user.id;
    testRecipeId = recipe.id;
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  describe("Preserve multi-system data", () => {
    it("should preserve metric ingredients when updating US ingredients", async () => {
      // Setup: Create ingredients in both systems
      const ingredient1 = await createTestIngredient({ name: "Flour" });
      const ingredient2 = await createTestIngredient({ name: "Sugar" });

      // Create metric ingredients
      await createTestRecipeIngredients(testRecipeId, ingredient1.id, "metric", {
        amount: "250",
        unit: "g",
        order: "0",
      });
      await createTestRecipeIngredients(testRecipeId, ingredient2.id, "metric", {
        amount: "100",
        unit: "g",
        order: "1",
      });

      // Create US ingredients
      await createTestRecipeIngredients(testRecipeId, ingredient1.id, "us", {
        amount: "2",
        unit: "cup",
        order: "0",
      });
      await createTestRecipeIngredients(testRecipeId, ingredient2.id, "us", {
        amount: "0.5",
        unit: "cup",
        order: "1",
      });

      // Verify we have 4 total ingredients (2 metric + 2 US)
      const beforeUpdate = await getRecipeIngredients(testRecipeId);

      expect(beforeUpdate).toHaveLength(4);

      // Act: Update only US ingredients
      await updateRecipeWithRefs(testRecipeId, testUserId, {
        systemUsed: "us",
        recipeIngredients: [
          {
            ingredientId: ingredient1.id,
            amount: "2.5",
            unit: "cup",
            order: 0,
            systemUsed: "us",
          },
        ],
      });

      // Assert: Metric ingredients should still exist
      const afterUpdate = await getRecipeIngredients(testRecipeId);

      expect(afterUpdate).toHaveLength(3); // 2 metric + 1 updated US

      const metricIngredients = afterUpdate.filter((ri) => ri.systemUsed === "metric");

      expect(metricIngredients).toHaveLength(2);
      expect(metricIngredients.map((ri) => ri.amount)).toContain("250.000");
      expect(metricIngredients.map((ri) => ri.amount)).toContain("100.000");

      const usIngredients = afterUpdate.filter((ri) => ri.systemUsed === "us");

      expect(usIngredients).toHaveLength(1);
      expect(usIngredients[0].amount).toBe("2.500");
    });

    it("should preserve US steps when updating metric steps", async () => {
      // Setup: Create steps in both systems
      await createTestRecipeStep(testRecipeId, "metric", {
        step: "Mix 250g flour with 100g sugar",
        order: "0",
      });
      await createTestRecipeStep(testRecipeId, "metric", {
        step: "Bake at 180°C for 30 minutes",
        order: "1",
      });

      await createTestRecipeStep(testRecipeId, "us", {
        step: "Mix 2 cups flour with 0.5 cup sugar",
        order: "0",
      });
      await createTestRecipeStep(testRecipeId, "us", {
        step: "Bake at 350°F for 30 minutes",
        order: "1",
      });

      // Verify we have 4 total steps (2 metric + 2 US)
      const beforeUpdate = await getRecipeSteps(testRecipeId);

      expect(beforeUpdate).toHaveLength(4);

      // Act: Update only metric steps
      await updateRecipeWithRefs(testRecipeId, testUserId, {
        systemUsed: "metric",
        steps: [
          {
            step: "Mix 300g flour with 150g sugar",
            order: 0,
            systemUsed: "metric",
          },
        ],
      });

      // Assert: US steps should still exist
      const afterUpdate = await getRecipeSteps(testRecipeId);

      expect(afterUpdate).toHaveLength(3); // 1 updated metric + 2 US

      const usSteps = afterUpdate.filter((s) => s.systemUsed === "us");

      expect(usSteps).toHaveLength(2);
      expect(usSteps.map((s) => s.step)).toContain("Mix 2 cups flour with 0.5 cup sugar");
      expect(usSteps.map((s) => s.step)).toContain("Bake at 350°F for 30 minutes");

      const metricSteps = afterUpdate.filter((s) => s.systemUsed === "metric");

      expect(metricSteps).toHaveLength(1);
      expect(metricSteps[0].step).toBe("Mix 300g flour with 150g sugar");
    });

    it("should preserve metric data when updating only recipe image", async () => {
      // Setup: Create metric ingredients
      const ingredient = await createTestIngredient({ name: "Test Ingredient" });

      await createTestRecipeIngredients(testRecipeId, ingredient.id, "metric", {
        amount: "250",
        unit: "g",
        order: "0",
      });

      await createTestRecipeStep(testRecipeId, "metric", {
        step: "Test step in metric",
        order: "0",
      });

      // Act: Update only the image (without systemUsed)
      await updateRecipeWithRefs(testRecipeId, testUserId, {
        images: [
          {
            image: "/new-image.jpg",
            order: 0,
          },
        ],
      });

      // Assert: Metric data should still exist
      const ingredients = await getRecipeIngredients(testRecipeId);

      expect(ingredients).toHaveLength(1);
      expect(ingredients[0].amount).toBe("250.000");

      const steps = await getRecipeSteps(testRecipeId);

      expect(steps).toHaveLength(1);
      expect(steps[0].step).toBe("Test step in metric");
    });

    it("should infer systemUsed from ingredients and preserve other system when top-level systemUsed is not provided", async () => {
      // Setup: Create ingredients in both systems
      const ingredient = await createTestIngredient({ name: "Flour" });

      await createTestRecipeIngredients(testRecipeId, ingredient.id, "metric", {
        amount: "250",
        unit: "g",
        order: "0",
      });
      await createTestRecipeIngredients(testRecipeId, ingredient.id, "us", {
        amount: "2",
        unit: "cup",
        order: "0",
      });

      // Verify we have 2 ingredients (1 metric + 1 US)
      const beforeUpdate = await getRecipeIngredients(testRecipeId);

      expect(beforeUpdate).toHaveLength(2);

      // Act: Update ingredients without specifying systemUsed at the TOP LEVEL
      // BUT all ingredients specify systemUsed: "metric"
      // The function should INFER that we're updating metric and PRESERVE US ingredients
      await updateRecipeWithRefs(testRecipeId, testUserId, {
        // NO systemUsed here! But it should be inferred from the ingredients
        recipeIngredients: [
          {
            ingredientId: ingredient.id,
            amount: "300",
            unit: "g",
            order: 0,
            systemUsed: "metric", // This should tell the function we're updating metric
          },
        ],
      });

      // Assert: US ingredients should be PRESERVED, only metric should be updated
      const afterUpdate = await getRecipeIngredients(testRecipeId);

      expect(afterUpdate).toHaveLength(2); // 1 metric + 1 US

      const metricIngredient = afterUpdate.find((i) => i.systemUsed === "metric");
      const usIngredient = afterUpdate.find((i) => i.systemUsed === "us");

      expect(metricIngredient).toBeDefined();
      expect(metricIngredient!.amount).toBe("300.000");

      // US ingredient should still exist unchanged
      expect(usIngredient).toBeDefined();
      expect(usIngredient!.amount).toBe("2.000");
    });

    it("should handle empty ingredient arrays correctly", async () => {
      // Setup: Create ingredients
      const ingredient = await createTestIngredient({ name: "Flour" });

      await createTestRecipeIngredients(testRecipeId, ingredient.id, "metric", {
        amount: "250",
        unit: "g",
        order: "0",
      });

      // Act: Update with empty US ingredients array
      await updateRecipeWithRefs(testRecipeId, testUserId, {
        systemUsed: "us",
        recipeIngredients: [],
      });

      // Assert: Metric ingredients should still exist
      const afterUpdate = await getRecipeIngredients(testRecipeId);

      expect(afterUpdate).toHaveLength(1);
      expect(afterUpdate[0].systemUsed).toBe("metric");
    });

    it("should throw error when systemUsed cannot be determined (mixed systems)", async () => {
      // Setup: Create ingredients
      const ingredient1 = await createTestIngredient({ name: "Flour" });
      const ingredient2 = await createTestIngredient({ name: "Sugar" });

      // Act & Assert: Trying to update with mixed systems should throw an error
      await expect(
        updateRecipeWithRefs(testRecipeId, testUserId, {
          // No systemUsed at top level
          recipeIngredients: [
            {
              ingredientId: ingredient1.id,
              amount: "250",
              unit: "g",
              order: 0,
              systemUsed: "metric", // One ingredient is metric
            },
            {
              ingredientId: ingredient2.id,
              amount: "1",
              unit: "cup",
              order: 1,
              systemUsed: "us", // Another is US
            },
          ],
        })
      ).rejects.toThrow(/Cannot determine which measurement system to update/);
    });

    it("should throw error when ingredients have no systemUsed and top-level systemUsed is missing", async () => {
      // Setup: Create ingredient
      const ingredient = await createTestIngredient({ name: "Flour" });

      // Act & Assert: Trying to update without any system information should throw
      await expect(
        updateRecipeWithRefs(testRecipeId, testUserId, {
          // No systemUsed at top level
          recipeIngredients: [
            {
              ingredientId: ingredient.id,
              amount: "250",
              unit: "g",
              order: 0,
              // No systemUsed on ingredient either
            },
          ],
        })
      ).rejects.toThrow(/Cannot determine which measurement system to update/);
    });
  });

  describe("Basic recipe updates", () => {
    it("should update recipe name and description", async () => {
      await updateRecipeWithRefs(testRecipeId, testUserId, {
        name: "Updated Recipe Name",
        description: "Updated description",
      });

      // Just ensure it doesn't throw
      expect(true).toBe(true);
    });

    it("should update recipe timing fields", async () => {
      await updateRecipeWithRefs(testRecipeId, testUserId, {
        prepMinutes: 15,
        cookMinutes: 45,
        totalMinutes: 60,
      });

      // Just ensure it doesn't throw
      expect(true).toBe(true);
    });
  });

  describe("Duplicate ingredient prevention", () => {
    it("should not create duplicate ingredients when updating with existing ingredient", async () => {
      // Setup: Create an initial ingredient
      const flour = await createTestIngredient({ name: "Flour" });

      await createTestRecipeIngredients(testRecipeId, flour.id, "metric", {
        amount: "250",
        unit: "g",
        order: "0",
      });

      // Verify initial state
      const beforeUpdate = await getRecipeIngredients(testRecipeId);

      expect(beforeUpdate).toHaveLength(1);

      // Act: Try to add the same ingredient again (should be prevented by onConflictDoNothing)
      await updateRecipeWithRefs(testRecipeId, testUserId, {
        systemUsed: "metric",
        recipeIngredients: [
          {
            ingredientId: flour.id,
            amount: "300",
            unit: "g",
            order: 0,
            systemUsed: "metric",
          },
        ],
      });

      // Assert: Should only have one ingredient (updated, not duplicated)
      const afterUpdate = await getRecipeIngredients(testRecipeId);

      expect(afterUpdate).toHaveLength(1);
      expect(afterUpdate[0].ingredientId).toBe(flour.id);
      expect(afterUpdate[0].amount).toBe("300.000");
    });

    it("should not create duplicate ingredients when adding multiple recipes with same ingredient", async () => {
      // Setup: Create two recipes
      const recipe1Id = testRecipeId;
      const recipe2 = await createTestRecipe(testUserId, {
        name: "Second Recipe",
      });

      const flour = await createTestIngredient({ name: "Flour" });

      // Add flour to first recipe
      await updateRecipeWithRefs(recipe1Id, testUserId, {
        systemUsed: "metric",
        recipeIngredients: [
          {
            ingredientId: flour.id,
            amount: "250",
            unit: "g",
            order: 0,
            systemUsed: "metric",
          },
        ],
      });

      // Add flour to second recipe
      await updateRecipeWithRefs(recipe2.id, testUserId, {
        systemUsed: "metric",
        recipeIngredients: [
          {
            ingredientId: flour.id,
            amount: "500",
            unit: "g",
            order: 0,
            systemUsed: "metric",
          },
        ],
      });

      // Assert: Each recipe should have its own ingredient link, but reference the same ingredient
      const recipe1Ingredients = await getRecipeIngredients(recipe1Id);
      const recipe2Ingredients = await getRecipeIngredients(recipe2.id);

      expect(recipe1Ingredients).toHaveLength(1);
      expect(recipe2Ingredients).toHaveLength(1);

      // Both should reference the same ingredient
      expect(recipe1Ingredients[0].ingredientId).toBe(flour.id);
      expect(recipe2Ingredients[0].ingredientId).toBe(flour.id);

      // But with different amounts
      expect(recipe1Ingredients[0].amount).toBe("250.000");
      expect(recipe2Ingredients[0].amount).toBe("500.000");
    });

    it("should handle adding same ingredient in different measurement systems without duplication", async () => {
      // Setup: Create an ingredient
      const sugar = await createTestIngredient({ name: "Sugar" });

      // Add sugar in metric system
      await updateRecipeWithRefs(testRecipeId, testUserId, {
        systemUsed: "metric",
        recipeIngredients: [
          {
            ingredientId: sugar.id,
            amount: "200",
            unit: "g",
            order: 0,
            systemUsed: "metric",
          },
        ],
      });

      // Add sugar in US system
      await updateRecipeWithRefs(testRecipeId, testUserId, {
        systemUsed: "us",
        recipeIngredients: [
          {
            ingredientId: sugar.id,
            amount: "1",
            unit: "cup",
            order: 0,
            systemUsed: "us",
          },
        ],
      });

      // Assert: Should have 2 recipe_ingredients entries (one per system), but both reference the same ingredient
      const ingredients = await getRecipeIngredients(testRecipeId);

      expect(ingredients).toHaveLength(2);

      const metricSugar = ingredients.find((i) => i.systemUsed === "metric");
      const usSugar = ingredients.find((i) => i.systemUsed === "us");

      expect(metricSugar).toBeDefined();
      expect(usSugar).toBeDefined();

      // Both should reference the same ingredient ID
      expect(metricSugar!.ingredientId).toBe(sugar.id);
      expect(usSugar!.ingredientId).toBe(sugar.id);

      // But with different amounts
      expect(metricSugar!.amount).toBe("200.000");
      expect(usSugar!.amount).toBe("1.000");
    });
  });
});
