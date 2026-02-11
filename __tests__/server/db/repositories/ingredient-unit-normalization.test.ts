// @vitest-environment node
/**
 * Integration tests for unit normalization in recipe ingredient creation/editing
 *
 * Verifies that locale-specific unit terms (e.g., "handvol", "scheut", "gr")
 * are normalized to canonical IDs (e.g., "handful", "splash", "gram") when saving.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";

import { createRecipeWithRefs, updateRecipeWithRefs } from "@/server/db/repositories/recipes";
import { getRecipeIngredients } from "@/__tests__/helpers/db-test-helpers";
import { RepositoryTestBase } from "@/__tests__/helpers/repository-test-base";

describe("Unit Normalization - Create/Edit Recipes", () => {
  let testUserId: string;
  let testRecipeId: string;
  const testBase = new RepositoryTestBase("test_unit_normalization");

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

  describe("createRecipeWithRefs - unit normalization", () => {
    it("should normalize Dutch 'handvol' to canonical 'handful' when creating recipe", async () => {
      const newRecipeId = crypto.randomUUID();

      await createRecipeWithRefs(newRecipeId, testUserId, {
        name: "Test Recipe with Dutch Units",
        systemUsed: "metric",
        recipeIngredients: [
          {
            ingredientId: null,
            ingredientName: "olie",
            amount: 1,
            unit: "handvol", // Dutch term for handful
            systemUsed: "metric",
            order: 0,
          },
        ],
        steps: [],
        tags: [],
      });

      const ingredients = await getRecipeIngredients(newRecipeId);

      expect(ingredients).toHaveLength(1);
      expect(ingredients[0].unit).toBe("handful"); // Should be normalized to canonical ID
    });

    it("should normalize Dutch 'scheut' to canonical 'splash'", async () => {
      const newRecipeId = crypto.randomUUID();

      await createRecipeWithRefs(newRecipeId, testUserId, {
        name: "Test Recipe",
        systemUsed: "metric",
        recipeIngredients: [
          {
            ingredientId: null,
            ingredientName: "olie",
            amount: 1,
            unit: "scheut", // Dutch term
            systemUsed: "metric",
            order: 0,
          },
        ],
        steps: [],
        tags: [],
      });

      const ingredients = await getRecipeIngredients(newRecipeId);

      expect(ingredients[0].unit).toBe("splash");
    });

    it("should normalize Dutch 'gram' to canonical 'gr'", async () => {
      const newRecipeId = crypto.randomUUID();

      await createRecipeWithRefs(newRecipeId, testUserId, {
        name: "Test Recipe",
        systemUsed: "metric",
        recipeIngredients: [
          {
            ingredientId: null,
            ingredientName: "olie",
            amount: 1,
            unit: "gram", // Dutch term
            systemUsed: "metric",
            order: 0,
          },
        ],
        steps: [],
        tags: [],
      });

      const ingredients = await getRecipeIngredients(newRecipeId);

      expect(ingredients[0].unit).toBe("gram");
    });

    it("should normalize Dutch 'theelepel' to canonical 'teaspoon'", async () => {
      const newRecipeId = crypto.randomUUID();

      await createRecipeWithRefs(newRecipeId, testUserId, {
        name: "Test Recipe",
        systemUsed: "metric",
        recipeIngredients: [
          {
            ingredientId: null,
            ingredientName: "zout",
            amount: 2,
            unit: "theelepel", // Dutch term
            systemUsed: "metric",
            order: 0,
          },
        ],
        steps: [],
        tags: [],
      });

      const ingredients = await getRecipeIngredients(newRecipeId);

      expect(ingredients[0].unit).toBe("teaspoon");
    });

    it("should preserve canonical IDs when already canonical", async () => {
      const newRecipeId = crypto.randomUUID();

      await createRecipeWithRefs(newRecipeId, testUserId, {
        name: "Test Recipe",
        systemUsed: "metric",
        recipeIngredients: [
          {
            ingredientId: null,
            ingredientName: "bloem",
            amount: 250,
            unit: "gram", // Already canonical
            systemUsed: "metric",
            order: 0,
          },
        ],
        steps: [],
        tags: [],
      });

      const ingredients = await getRecipeIngredients(newRecipeId);

      expect(ingredients[0].unit).toBe("gram");
    });
  });

  describe("updateRecipeWithRefs - unit normalization", () => {
    it("should normalize Dutch 'handvol' to canonical 'handful' when updating recipe", async () => {
      await updateRecipeWithRefs(testRecipeId, testUserId, {
        systemUsed: "metric",
        recipeIngredients: [
          {
            ingredientId: null,
            ingredientName: "olie",
            amount: 1,
            unit: "handvol", // Dutch term
            systemUsed: "metric",
            order: 0,
          },
        ],
      });

      const ingredients = await getRecipeIngredients(testRecipeId);

      expect(ingredients).toHaveLength(1);
      expect(ingredients[0].unit).toBe("handful"); // Should be normalized
    });

    it("should normalize when updating with ingredientName instead of ingredientId", async () => {
      await updateRecipeWithRefs(testRecipeId, testUserId, {
        systemUsed: "metric",
        recipeIngredients: [
          {
            ingredientName: "olie",
            amount: 1,
            unit: "scheut", // Dutch term
            systemUsed: "metric",
            order: 0,
          },
        ],
      });

      const ingredients = await getRecipeIngredients(testRecipeId);

      expect(ingredients[0].unit).toBe("splash");
    });

    it("should normalize multiple ingredients with different locale-specific units", async () => {
      await updateRecipeWithRefs(testRecipeId, testUserId, {
        systemUsed: "metric",
        recipeIngredients: [
          {
            ingredientId: null,
            ingredientName: "suiker",
            amount: 500,
            unit: "gr", // Dutch => gram
            systemUsed: "metric",
            order: 0,
          },
          {
            ingredientId: null,
            ingredientName: "olie",
            amount: 1,
            unit: "scheut", // Dutch => splash
            systemUsed: "metric",
            order: 1,
          },
          {
            ingredientId: null,
            ingredientName: "noten",
            amount: 1,
            unit: "handvol", // Dutch => handful
            systemUsed: "metric",
            order: 2,
          },
        ],
      });

      const ingredients = await getRecipeIngredients(testRecipeId);

      expect(ingredients).toHaveLength(3);
      expect(ingredients.find((i) => i.order === "0")?.unit).toBe("gram");
      expect(ingredients.find((i) => i.order === "1")?.unit).toBe("splash");
      expect(ingredients.find((i) => i.order === "2")?.unit).toBe("handful");
    });
  });
});
