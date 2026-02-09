import { describe, it, expect, beforeEach, vi } from "vitest";

import {
  parseMealieDatabase,
  parseMealieRecipeToDTO,
  buildMealieLookups,
  type MealieRecipe,
  type MealieIngredient,
  type MealieInstruction,
  type MealieDatabase,
  type MealieLookups,
} from "@/server/importers/mealie-parser";

// @vitest-environment node

// Mock the downloader to avoid actual image saving
vi.mock("@/server/downloader", () => ({
  saveImageBytes: vi.fn().mockResolvedValue("mocked-image-guid"),
}));

// Mock getUnits to avoid database calls
vi.mock("@/config/server-config-loader", () => ({
  getUnits: vi.fn().mockResolvedValue({}),
}));

/**
 * Helper to create empty lookups for simple tests
 */
function createEmptyLookups(): MealieLookups {
  return {
    foods: new Map(),
    units: new Map(),
    tags: new Map(),
    categories: new Map(),
    recipeTags: new Map(),
    recipeCategories: new Map(),
    recipeRatings: new Map(),
    recipeNutrition: new Map(),
  };
}

/**
 * Helper to create a minimal database for testing
 */
function createMinimalDatabase(overrides: Partial<MealieDatabase> = {}): MealieDatabase {
  return {
    recipes: [],
    recipes_ingredients: [],
    recipe_instructions: [],
    ingredient_foods: [],
    ingredient_units: [],
    tags: [],
    recipes_to_tags: [],
    categories: [],
    recipes_to_categories: [],
    users_to_recipes: [],
    recipe_nutrition: [],
    ...overrides,
  };
}

describe("Mealie Parser", () => {
  describe("parseMealieDatabase", () => {
    it("parses valid database.json with all tables", async () => {
      const json = JSON.stringify({
        recipes: [{ id: "1", name: "Test Recipe" }],
        recipes_ingredients: [{ id: 1, recipe_id: "1", note: "1 cup flour" }],
        recipe_instructions: [{ id: "i1", recipe_id: "1", position: 0, text: "Mix ingredients" }],
        ingredient_foods: [{ id: "food-1", name: "flour" }],
        ingredient_units: [{ id: "unit-1", name: "cup" }],
        tags: [{ id: "tag-1", name: "Dinner" }],
        recipes_to_tags: [{ recipe_id: "1", tag_id: "tag-1" }],
        categories: [{ id: "cat-1", name: "Italian" }],
        recipes_to_categories: [{ recipe_id: "1", category_id: "cat-1" }],
      });

      const result = await parseMealieDatabase(json);

      expect(result.recipes).toHaveLength(1);
      expect(result.recipes_ingredients).toHaveLength(1);
      expect(result.recipe_instructions).toHaveLength(1);
      expect(result.ingredient_foods).toHaveLength(1);
      expect(result.ingredient_units).toHaveLength(1);
      expect(result.tags).toHaveLength(1);
      expect(result.recipes_to_tags).toHaveLength(1);
      expect(result.categories).toHaveLength(1);
      expect(result.recipes_to_categories).toHaveLength(1);
    });

    it("handles missing arrays", async () => {
      const json = JSON.stringify({});
      const result = await parseMealieDatabase(json);

      expect(result.recipes).toEqual([]);
      expect(result.recipes_ingredients).toEqual([]);
      expect(result.recipe_instructions).toEqual([]);
      expect(result.ingredient_foods).toEqual([]);
      expect(result.ingredient_units).toEqual([]);
      expect(result.tags).toEqual([]);
      expect(result.recipes_to_tags).toEqual([]);
      expect(result.categories).toEqual([]);
      expect(result.recipes_to_categories).toEqual([]);
    });

    it("throws on invalid JSON", async () => {
      await expect(parseMealieDatabase("invalid json")).rejects.toThrow(
        "Failed to parse database.json"
      );
    });
  });

  describe("buildMealieLookups", () => {
    it("builds lookup maps correctly", () => {
      const database = createMinimalDatabase({
        ingredient_foods: [
          { id: "food-1", name: "flour" },
          { id: "food-2", name: "sugar" },
        ],
        ingredient_units: [
          { id: "unit-1", name: "cup" },
          { id: "unit-2", name: "tablespoon" },
        ],
        tags: [
          { id: "tag-1", name: "Dinner" },
          { id: "tag-2", name: "Quick" },
        ],
        categories: [{ id: "cat-1", name: "Italian" }],
        recipes_to_tags: [
          { recipe_id: "recipe-1", tag_id: "tag-1" },
          { recipe_id: "recipe-1", tag_id: "tag-2" },
        ],
        recipes_to_categories: [{ recipe_id: "recipe-1", category_id: "cat-1" }],
      });

      const lookups = buildMealieLookups(database);

      expect(lookups.foods.get("food-1")?.name).toBe("flour");
      expect(lookups.foods.get("food-2")?.name).toBe("sugar");
      expect(lookups.units.get("unit-1")?.name).toBe("cup");
      expect(lookups.tags.get("tag-1")?.name).toBe("Dinner");
      expect(lookups.categories.get("cat-1")?.name).toBe("Italian");
      expect(lookups.recipeTags.get("recipe-1")).toEqual(["tag-1", "tag-2"]);
      expect(lookups.recipeCategories.get("recipe-1")).toEqual(["cat-1"]);
    });
  });

  describe("parseMealieRecipeToDTO", () => {
    let mockRecipe: MealieRecipe;
    let mockIngredients: MealieIngredient[];
    let mockInstructions: MealieInstruction[];
    let lookups: MealieLookups;

    beforeEach(() => {
      mockRecipe = {
        id: "recipe-1",
        name: "Vegetarian Shakshuka",
        description: "A delicious vegetarian dish",
        org_url: "https://example.com/recipe",
        recipe_servings: 4,
        prep_time: 15,
        cook_time: 30,
        total_time: 45,
      };

      // Ingredients with original_text (unparsed)
      mockIngredients = [
        {
          id: 1,
          recipe_id: "recipe-1",
          original_text: "2 cups tomatoes, diced",
          position: 0,
        },
        {
          id: 2,
          recipe_id: "recipe-1",
          original_text: "1 tablespoon olive oil",
          position: 1,
        },
      ];

      mockInstructions = [
        {
          id: "inst-1",
          recipe_id: "recipe-1",
          position: 0,
          text: "Heat oil in a pan",
        },
        {
          id: "inst-2",
          recipe_id: "recipe-1",
          position: 1,
          text: "Add tomatoes and simmer",
        },
      ];

      lookups = createEmptyLookups();
    });

    it("maps Mealie recipe to DTO correctly", async () => {
      const dto = await parseMealieRecipeToDTO(
        mockRecipe,
        mockIngredients,
        mockInstructions,
        lookups
      );

      expect(dto).not.toBeNull();
      expect(dto!.name).toBe("Vegetarian Shakshuka");
      expect(dto!.description).toBe("A delicious vegetarian dish");
      expect(dto!.url).toBe("https://example.com/recipe");
      expect(dto!.servings).toBe(4);
      expect(dto!.prepMinutes).toBe(15);
      expect(dto!.cookMinutes).toBe(30);
      expect(dto!.totalMinutes).toBe(45);
    });

    it("parses ingredients from original_text", async () => {
      const dto = await parseMealieRecipeToDTO(
        mockRecipe,
        mockIngredients,
        mockInstructions,
        lookups
      );

      expect(dto).not.toBeNull();
      expect(dto!.recipeIngredients).toHaveLength(2);
      // Ingredients are now parsed - amount/unit extracted, description remains
      // Note: parseIngredientWithDefaults normalizes units to singular form
      expect(dto!.recipeIngredients![0].ingredientName).toBe("tomatoes, diced");
      expect(dto!.recipeIngredients![0].amount).toBe(2);
      expect(dto!.recipeIngredients![0].unit).toBe("cup");
      expect(dto!.recipeIngredients![1].ingredientName).toBe("olive oil");
      expect(dto!.recipeIngredients![1].amount).toBe(1);
      expect(dto!.recipeIngredients![1].unit).toBe("tablespoon");
    });

    it("resolves parsed ingredients with food_id", async () => {
      // Simulate Mealie "parsed" ingredients with food_id and unit_id
      const parsedIngredients: MealieIngredient[] = [
        {
          id: 1,
          recipe_id: "recipe-1",
          food_id: "food-flour",
          unit_id: "unit-cup",
          quantity: 2,
          note: "",
          original_text: null as any,
          position: 0,
        },
        {
          id: 2,
          recipe_id: "recipe-1",
          food_id: "food-sugar",
          unit_id: "unit-tbsp",
          quantity: 1,
          note: "packed",
          original_text: null as any,
          position: 1,
        },
      ];

      const parsedLookups = createEmptyLookups();

      parsedLookups.foods.set("food-flour", { id: "food-flour", name: "flour" });
      parsedLookups.foods.set("food-sugar", { id: "food-sugar", name: "brown sugar" });
      parsedLookups.units.set("unit-cup", { id: "unit-cup", name: "cup" });
      parsedLookups.units.set("unit-tbsp", { id: "unit-tbsp", name: "tablespoon" });

      const dto = await parseMealieRecipeToDTO(
        mockRecipe,
        parsedIngredients,
        mockInstructions,
        parsedLookups
      );

      expect(dto).not.toBeNull();
      expect(dto!.recipeIngredients).toHaveLength(2);
      // First ingredient: food name only (no note)
      expect(dto!.recipeIngredients![0].ingredientName).toBe("flour");
      expect(dto!.recipeIngredients![0].amount).toBe(2);
      expect(dto!.recipeIngredients![0].unit).toBe("cup");
      // Second ingredient: food name + note
      expect(dto!.recipeIngredients![1].ingredientName).toBe("brown sugar, packed");
      expect(dto!.recipeIngredients![1].amount).toBe(1);
      expect(dto!.recipeIngredients![1].unit).toBe("tablespoon");
    });

    it("uses parsed original_text description for parsed ingredients to avoid duplicated amount/unit text", async () => {
      const parsedIngredients: MealieIngredient[] = [
        {
          id: 1,
          recipe_id: "recipe-1",
          food_id: "food-butter",
          unit_id: "unit-tbsp",
          quantity: 1,
          original_text: "1 tablespoon butter",
          note: "",
          position: 0,
        },
      ];

      const parsedLookups = createEmptyLookups();

      parsedLookups.foods.set("food-butter", { id: "food-butter", name: "butter" });
      parsedLookups.units.set("unit-tbsp", { id: "unit-tbsp", name: "tablespoon" });

      const dto = await parseMealieRecipeToDTO(
        mockRecipe,
        parsedIngredients,
        mockInstructions,
        parsedLookups
      );

      expect(dto).not.toBeNull();
      expect(dto!.recipeIngredients).toHaveLength(1);
      expect(dto!.recipeIngredients![0].ingredientName).toBe("butter");
      expect(dto!.recipeIngredients![0].amount).toBe(1);
      expect(dto!.recipeIngredients![0].unit).toBe("tablespoon");
    });

    it("falls back to Mealie quantity and unit when parsing original_text cannot extract them", async () => {
      const parsedIngredients: MealieIngredient[] = [
        {
          id: 1,
          recipe_id: "recipe-1",
          food_id: "food-butter",
          unit_id: "unit-tbsp",
          quantity: 2,
          original_text: "butter, softened",
          note: "softened",
          position: 0,
        },
      ];

      const parsedLookups = createEmptyLookups();

      parsedLookups.foods.set("food-butter", { id: "food-butter", name: "butter" });
      parsedLookups.units.set("unit-tbsp", { id: "unit-tbsp", name: "tablespoon" });

      const dto = await parseMealieRecipeToDTO(
        mockRecipe,
        parsedIngredients,
        mockInstructions,
        parsedLookups
      );

      expect(dto).not.toBeNull();
      expect(dto!.recipeIngredients).toHaveLength(1);
      expect(dto!.recipeIngredients![0].ingredientName).toBe("butter, softened");
      expect(dto!.recipeIngredients![0].amount).toBe(2);
      expect(dto!.recipeIngredients![0].unit).toBe("tablespoon");
    });

    it("throws error for recipe with all empty ingredients (no food_id, no original_text, no note)", async () => {
      const emptyIngredients: MealieIngredient[] = [
        {
          id: 1,
          recipe_id: "recipe-1",
          food_id: null,
          unit_id: "unit-cup",
          quantity: 0,
          note: "",
          original_text: null as any,
          position: 0,
        },
        {
          id: 2,
          recipe_id: "recipe-1",
          food_id: null,
          unit_id: "",
          quantity: 0,
          note: "",
          original_text: null as any,
          position: 1,
        },
      ];

      await expect(
        parseMealieRecipeToDTO(mockRecipe, emptyIngredients, mockInstructions, lookups)
      ).rejects.toThrow("has no valid ingredients after filtering empty ones");
    });

    it("skips empty ingredients and imports recipe when some ingredients are valid", async () => {
      const mixedIngredients: MealieIngredient[] = [
        {
          id: 1,
          recipe_id: "recipe-1",
          original_text: "2 cups tomatoes",
          position: 0,
        },
        {
          id: 2,
          recipe_id: "recipe-1",
          food_id: null,
          unit_id: "",
          quantity: 0,
          note: "",
          original_text: null as any,
          position: 1, // This empty one should be skipped
        },
        {
          id: 3,
          recipe_id: "recipe-1",
          original_text: "1 tablespoon olive oil",
          position: 2,
        },
      ];

      const dto = await parseMealieRecipeToDTO(
        mockRecipe,
        mixedIngredients,
        mockInstructions,
        lookups
      );

      expect(dto).not.toBeNull();
      expect(dto!.recipeIngredients).toHaveLength(2); // Empty ingredient skipped
      // Ingredients are now parsed - amount/unit extracted, description remains
      // Note: parseIngredientWithDefaults normalizes units to singular form
      expect(dto!.recipeIngredients![0].ingredientName).toBe("tomatoes");
      expect(dto!.recipeIngredients![0].amount).toBe(2);
      expect(dto!.recipeIngredients![0].unit).toBe("cup");
      expect(dto!.recipeIngredients![1].ingredientName).toBe("olive oil");
      expect(dto!.recipeIngredients![1].amount).toBe(1);
      expect(dto!.recipeIngredients![1].unit).toBe("tablespoon");
    });

    it("resolves tags from recipes_to_tags", async () => {
      const lookupsWithTags = createEmptyLookups();

      lookupsWithTags.tags.set("tag-1", { id: "tag-1", name: "Dinner" });
      lookupsWithTags.tags.set("tag-2", { id: "tag-2", name: "Quick Meals" });
      lookupsWithTags.recipeTags.set("recipe-1", ["tag-1", "tag-2"]);

      const dto = await parseMealieRecipeToDTO(
        mockRecipe,
        mockIngredients,
        mockInstructions,
        lookupsWithTags
      );

      expect(dto).not.toBeNull();
      expect(dto!.tags).toHaveLength(2);
      expect(dto!.tags!.map((t) => t.name)).toContain("Dinner");
      expect(dto!.tags!.map((t) => t.name)).toContain("Quick Meals");
    });

    it("resolves categories as tags", async () => {
      const lookupsWithCategories = createEmptyLookups();

      lookupsWithCategories.categories.set("cat-1", { id: "cat-1", name: "Italian" });
      lookupsWithCategories.recipeCategories.set("recipe-1", ["cat-1"]);

      const dto = await parseMealieRecipeToDTO(
        mockRecipe,
        mockIngredients,
        mockInstructions,
        lookupsWithCategories
      );

      expect(dto).not.toBeNull();
      expect(dto!.tags).toHaveLength(1);
      expect(dto!.tags![0].name).toBe("Italian");
    });

    it("deduplicates tags and categories by name (case-insensitive)", async () => {
      const lookupsWithDuplicates = createEmptyLookups();

      lookupsWithDuplicates.tags.set("tag-1", { id: "tag-1", name: "Dinner" });
      lookupsWithDuplicates.categories.set("cat-1", { id: "cat-1", name: "dinner" }); // same but lowercase
      lookupsWithDuplicates.recipeTags.set("recipe-1", ["tag-1"]);
      lookupsWithDuplicates.recipeCategories.set("recipe-1", ["cat-1"]);

      const dto = await parseMealieRecipeToDTO(
        mockRecipe,
        mockIngredients,
        mockInstructions,
        lookupsWithDuplicates
      );

      expect(dto).not.toBeNull();
      // Should deduplicate - only one "Dinner" tag
      expect(dto!.tags).toHaveLength(1);
      expect(dto!.tags![0].name).toBe("Dinner");
    });

    it("sorts instructions by position", async () => {
      const shuffled = [mockInstructions[1], mockInstructions[0]];
      const dto = await parseMealieRecipeToDTO(mockRecipe, mockIngredients, shuffled, lookups);

      expect(dto).not.toBeNull();
      expect(dto!.steps![0].step).toBe("Heat oil in a pan");
      expect(dto!.steps![1].step).toBe("Add tomatoes and simmer");
    });

    it("parses human-readable time strings like '1 hour 45 minutes'", async () => {
      mockRecipe.prep_time = "30 minutes" as any;
      mockRecipe.cook_time = "1 hour 45 minutes" as any;
      mockRecipe.total_time = "2 hours 15 minutes" as any;

      const dto = await parseMealieRecipeToDTO(
        mockRecipe,
        mockIngredients,
        mockInstructions,
        lookups
      );

      expect(dto).not.toBeNull();
      expect(dto!.prepMinutes).toBe(30);
      expect(dto!.cookMinutes).toBe(105); // 1 hour 45 minutes = 105 minutes
      expect(dto!.totalMinutes).toBe(135); // 2 hours 15 minutes = 135 minutes
    });

    it("parses abbreviated time strings like '1 hr', '20 mins'", async () => {
      mockRecipe.prep_time = "20 mins" as any;
      mockRecipe.cook_time = "1 hr" as any;
      mockRecipe.total_time = null;

      const dto = await parseMealieRecipeToDTO(
        mockRecipe,
        mockIngredients,
        mockInstructions,
        lookups
      );

      expect(dto).not.toBeNull();
      expect(dto!.prepMinutes).toBe(20);
      expect(dto!.cookMinutes).toBe(60); // 1 hr = 60 minutes
      expect(dto!.totalMinutes).toBe(80); // calculated: 20 + 60
    });

    it("handles null time fields", async () => {
      mockRecipe.prep_time = null;
      mockRecipe.cook_time = null;
      mockRecipe.total_time = null;

      const dto = await parseMealieRecipeToDTO(
        mockRecipe,
        mockIngredients,
        mockInstructions,
        lookups
      );

      expect(dto).not.toBeNull();
      expect(dto!.prepMinutes).toBeUndefined();
      expect(dto!.cookMinutes).toBeUndefined();
      expect(dto!.totalMinutes).toBeUndefined();
    });

    it("uses perform_time as cook_time when cook_time is null", async () => {
      mockRecipe.total_time = null;
      mockRecipe.cook_time = null;
      mockRecipe.prep_time = 20;
      mockRecipe.perform_time = 60;

      const dto = await parseMealieRecipeToDTO(
        mockRecipe,
        mockIngredients,
        mockInstructions,
        lookups
      );

      expect(dto).not.toBeNull();
      expect(dto!.prepMinutes).toBe(20);
      expect(dto!.cookMinutes).toBe(60); // perform_time only
      expect(dto!.totalMinutes).toBe(80); // calculated: 20 + 60
    });

    it("calculates total_time from prep_time and cook_time when total_time is null", async () => {
      mockRecipe.total_time = null;
      mockRecipe.prep_time = 15;
      mockRecipe.cook_time = 30;
      mockRecipe.perform_time = null;

      const dto = await parseMealieRecipeToDTO(
        mockRecipe,
        mockIngredients,
        mockInstructions,
        lookups
      );

      expect(dto).not.toBeNull();
      expect(dto!.totalMinutes).toBe(45);
    });

    it("adds cook_time and perform_time when both are present", async () => {
      mockRecipe.total_time = null;
      mockRecipe.cook_time = 30;
      mockRecipe.perform_time = 60;
      mockRecipe.prep_time = 10;

      const dto = await parseMealieRecipeToDTO(
        mockRecipe,
        mockIngredients,
        mockInstructions,
        lookups
      );

      expect(dto).not.toBeNull();
      expect(dto!.cookMinutes).toBe(90); // cook_time + perform_time
      expect(dto!.totalMinutes).toBe(100); // 10 + 90
    });

    it("handles missing servings with fallback to recipe_yield_quantity", async () => {
      mockRecipe.recipe_servings = 0;
      mockRecipe.recipe_yield_quantity = 6;

      const dto = await parseMealieRecipeToDTO(
        mockRecipe,
        mockIngredients,
        mockInstructions,
        lookups
      );

      expect(dto).not.toBeNull();
      expect(dto!.servings).toBe(6);
    });

    it("filters out empty instructions", async () => {
      const emptyInstruction: MealieInstruction = {
        id: "inst-3",
        recipe_id: "recipe-1",
        position: 2,
        text: "",
      };

      const dto = await parseMealieRecipeToDTO(
        mockRecipe,
        mockIngredients,
        [...mockInstructions, emptyInstruction],
        lookups
      );

      expect(dto).not.toBeNull();
      expect(dto!.steps).toHaveLength(2);
    });

    it("throws when recipe name is missing", async () => {
      mockRecipe.name = "";

      await expect(
        parseMealieRecipeToDTO(mockRecipe, mockIngredients, mockInstructions, lookups)
      ).rejects.toThrow("Missing recipe name");
    });

    it("handles recipe with image buffer", async () => {
      const imageBuffer = Buffer.from("fake-image-data");
      const dto = await parseMealieRecipeToDTO(
        mockRecipe,
        mockIngredients,
        mockInstructions,
        lookups,
        imageBuffer
      );

      expect(dto).not.toBeNull();
      expect(dto!.image).toBe("mocked-image-guid");
    });

    it("falls back to note when original_text is missing", async () => {
      const noteOnlyIngredients: MealieIngredient[] = [
        {
          id: 1,
          recipe_id: "recipe-1",
          note: "some ingredient note",
          position: 0,
        },
      ];

      const dto = await parseMealieRecipeToDTO(
        mockRecipe,
        noteOnlyIngredients,
        mockInstructions,
        lookups
      );

      expect(dto).not.toBeNull();
      expect(dto!.recipeIngredients).toHaveLength(1);
      expect(dto!.recipeIngredients![0].ingredientName).toBe("some ingredient note");
    });

    it("parses quantity from note when quantity is 0 (quantity embedded in text)", async () => {
      const zeroQuantityIngredients: MealieIngredient[] = [
        {
          id: 1,
          recipe_id: "recipe-1",
          note: "500 g lean minced beef",
          quantity: 0,
          original_text: null as any,
          position: 0,
        },
      ];

      const dto = await parseMealieRecipeToDTO(
        mockRecipe,
        zeroQuantityIngredients,
        mockInstructions,
        lookups
      );

      expect(dto).not.toBeNull();
      expect(dto!.recipeIngredients).toHaveLength(1);
      // Now parses the note to extract quantity/unit, so scaling works correctly
      expect(dto!.recipeIngredients![0].ingredientName).toBe("lean minced beef");
      expect(dto!.recipeIngredients![0].amount).toBe(500);
      expect(dto!.recipeIngredients![0].unit).toBe("gram");
    });
  });
});
