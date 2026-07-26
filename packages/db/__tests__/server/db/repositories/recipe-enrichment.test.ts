// @vitest-environment node

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  replaceRecipeCategories,
  replaceRecipeCategoriesIfAbsent,
  replaceRecipeNutrition,
  replaceRecipeNutritionIfAbsent,
} from "@norish/db/repositories/recipe-enrichment";
import { getRecipeFull } from "@norish/db/repositories/recipes";
import { appendRecipeTags, getRecipeTagNames } from "@norish/db/repositories/tags";

import { createTestRecipe } from "../../../helpers/db-test-helpers";
import { RepositoryTestBase } from "../../../helpers/repository-test-base";

const testBase = new RepositoryTestBase("test_recipe_enrichment");
let userId: string;
let testRecipe: Awaited<ReturnType<typeof createTestRecipe>>;

describe("Recipe Enrichment repository", () => {
  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    const [user, recipe] = await testBase.beforeEachTest();
    userId = user.id;
    testRecipe = recipe;
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  describe("appendRecipeTags", () => {
    it("adds new tags without removing existing ones", async () => {
      await appendRecipeTags(testRecipe.id, ["Supplied"]);
      const result = await appendRecipeTags(testRecipe.id, ["Vegan", "Quick"]);

      expect(result.added).toEqual(["Vegan", "Quick"]);
      expect(await getRecipeTagNames(testRecipe.id)).toEqual(
        expect.arrayContaining(["Supplied", "Vegan", "Quick"])
      );
    });

    it("is idempotent under job retry", async () => {
      await appendRecipeTags(testRecipe.id, ["Vegan"]);
      const second = await appendRecipeTags(testRecipe.id, ["Vegan"]);

      expect(second.added).toEqual([]);
      expect(await getRecipeTagNames(testRecipe.id)).toEqual(["Vegan"]);
    });

    it("normalizes duplicates, blanks, and casing", async () => {
      await appendRecipeTags(testRecipe.id, ["Vegan"]);
      const result = await appendRecipeTags(testRecipe.id, [
        "  vegan ",
        "",
        "   ",
        "Quick",
        "quick",
      ]);

      expect(result.added).toEqual(["Quick"]);
      expect(await getRecipeTagNames(testRecipe.id)).toEqual(["Vegan", "Quick"]);
    });

    it("keeps both finding sets when two appends run concurrently", async () => {
      await appendRecipeTags(testRecipe.id, ["Supplied"]);

      await Promise.all([
        appendRecipeTags(testRecipe.id, ["Tag-A", "Tag-B"]),
        appendRecipeTags(testRecipe.id, ["Allergen-Milk", "Allergen-Egg"]),
      ]);

      expect(await getRecipeTagNames(testRecipe.id)).toEqual(
        expect.arrayContaining(["Supplied", "Tag-A", "Tag-B", "Allergen-Milk", "Allergen-Egg"])
      );
    });
  });

  describe("replaceRecipeCategories", () => {
    it("replaces the complete list unconditionally", async () => {
      await replaceRecipeCategories(testRecipe.id, ["Breakfast"]);
      const applied = await replaceRecipeCategories(testRecipe.id, ["Dinner", "Snack"]);

      expect(applied).toBe(true);
      expect((await getRecipeFull(testRecipe.id))?.categories).toEqual(["Dinner", "Snack"]);
    });

    it("rejects an empty proposal without touching stored values", async () => {
      await replaceRecipeCategories(testRecipe.id, ["Breakfast"]);

      await expect(replaceRecipeCategories(testRecipe.id, [])).rejects.toThrow();
      expect((await getRecipeFull(testRecipe.id))?.categories).toEqual(["Breakfast"]);
    });
  });

  describe("replaceRecipeCategoriesIfAbsent", () => {
    it("applies while the stored list is empty", async () => {
      const applied = await replaceRecipeCategoriesIfAbsent(testRecipe.id, ["Dinner"]);

      expect(applied).toBe(true);
      expect((await getRecipeFull(testRecipe.id))?.categories).toEqual(["Dinner"]);
    });

    it("becomes a no-op when data appeared while AI was running", async () => {
      await replaceRecipeCategories(testRecipe.id, ["Breakfast"]);

      const applied = await replaceRecipeCategoriesIfAbsent(testRecipe.id, ["Dinner"]);

      expect(applied).toBe(false);
      expect((await getRecipeFull(testRecipe.id))?.categories).toEqual(["Breakfast"]);
    });
  });

  describe("replaceRecipeNutrition", () => {
    it("replaces the whole group atomically and clears omitted fields", async () => {
      await replaceRecipeNutrition(testRecipe.id, {
        calories: 500,
        fat: "20",
        carbs: "40",
        protein: "30",
      });

      const applied = await replaceRecipeNutrition(testRecipe.id, { calories: 240 });

      expect(applied).toBe(true);

      const recipe = await getRecipeFull(testRecipe.id);

      expect(recipe?.calories).toBe(240);
      expect(recipe?.fat).toBeNull();
      expect(recipe?.carbs).toBeNull();
      expect(recipe?.protein).toBeNull();
    });

    it("rejects an entirely blank proposal without touching stored values", async () => {
      await replaceRecipeNutrition(testRecipe.id, { calories: 500 });

      await expect(
        replaceRecipeNutrition(testRecipe.id, {
          calories: null,
          fat: "  ",
          carbs: "",
          protein: null,
        })
      ).rejects.toThrow();
      expect((await getRecipeFull(testRecipe.id))?.calories).toBe(500);
    });
  });

  describe("replaceRecipeNutritionIfAbsent", () => {
    it("applies while the whole group is absent", async () => {
      const applied = await replaceRecipeNutritionIfAbsent(testRecipe.id, {
        calories: 240,
        fat: "9",
        carbs: "30",
        protein: "12",
      });

      expect(applied).toBe(true);
      expect((await getRecipeFull(testRecipe.id))?.calories).toBe(240);
    });

    it("leaves partial supplied nutrition untouched", async () => {
      const supplied = await createTestRecipe(userId, { name: "Supplied protein", protein: "31" });

      const applied = await replaceRecipeNutritionIfAbsent(supplied.id, {
        calories: 240,
        fat: "9",
        carbs: "30",
        protein: "12",
      });

      expect(applied).toBe(false);

      const recipe = await getRecipeFull(supplied.id);

      expect(recipe?.protein).toBe("31.00");
      expect(recipe?.calories).toBeNull();
    });
  });
});
