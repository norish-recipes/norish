import { gzip } from "zlib";
import { promisify } from "util";

import { describe, it, expect, beforeEach, vi } from "vitest";
import JSZip from "jszip";

import {
  parsePaprikaRecipeToDTO,
  extractPaprikaRecipes,
  type PaprikaRecipe,
  PaprikaRecipeSchema,
} from "@/server/importers/paprika-parser";

// @vitest-environment node

const gzipAsync = promisify(gzip);

/**
 * Helper to create a gzip-compressed JSON buffer (the real Paprika format)
 */
async function createPaprikaRecipeBuffer(recipe: Record<string, unknown>): Promise<Buffer> {
  const json = JSON.stringify(recipe);

  return await gzipAsync(Buffer.from(json, "utf-8"));
}

// Mock the server config loader to avoid database calls
// getUnits should return a flat UnitsMap (empty object works for tests)
vi.mock("@/config/server-config-loader", () => ({
  getUnits: vi.fn().mockResolvedValue({}),
  getContentIndicators: vi.fn().mockResolvedValue([]),
  getRecurrenceConfig: vi.fn().mockResolvedValue({}),
}));

// Mock the downloader to avoid actual image saving
vi.mock("@/server/downloader", () => ({
  saveImageBytes: vi.fn().mockResolvedValue("mocked-image-guid"),
}));

describe("Paprika Parser", () => {
  describe("PaprikaRecipeSchema", () => {
    it("validates a complete Paprika recipe", () => {
      const recipe = {
        name: "Dutch Baby",
        description: "A fluffy oven-baked pancake",
        ingredients: "3 eggs\n1 cup flour\n1 cup milk",
        directions: "Preheat oven to 425°F.\nMix ingredients.\nBake for 20 minutes.",
        notes: "Serve with powdered sugar",
        categories: ["Breakfast", "Dutch"],
        rating: 5,
        prep_time: "10 min",
        cook_time: "20 min",
        total_time: "30 min",
        servings: "4",
        difficulty: "Easy",
        source: "https://example.com/recipe",
        source_url: "https://example.com/recipe",
        photo_hash: "ABC123",
        photos: [{ data: "base64data", filename: "photo.jpg" }],
        uid: "12345",
        created: "2021-01-01",
        nutritional_info: "",
      };

      const result = PaprikaRecipeSchema.parse(recipe);

      expect(result.name).toBe("Dutch Baby");
      expect(result.categories).toHaveLength(2);
      expect(result.photos).toHaveLength(1);
    });

    it("validates minimal recipe", () => {
      const recipe = {
        name: "Minimal Recipe",
      };

      const result = PaprikaRecipeSchema.parse(recipe);

      expect(result.name).toBe("Minimal Recipe");
      expect(result.categories).toEqual([]);
      expect(result.photos).toEqual([]);
    });

    it("throws on missing name", () => {
      expect(() => PaprikaRecipeSchema.parse({})).toThrow();
    });

    it("handles null and undefined values gracefully", () => {
      const recipe = {
        name: "Test Recipe",
        description: null,
        ingredients: undefined,
        directions: null,
        prep_time: null,
        cook_time: null,
        servings: null,
      };

      const result = PaprikaRecipeSchema.parse(recipe);

      expect(result.name).toBe("Test Recipe");
      expect(result.description).toBeNull();
      expect(result.ingredients).toBeUndefined();
    });
  });

  describe("parsePaprikaRecipeToDTO", () => {
    let mockRecipe: PaprikaRecipe;

    beforeEach(() => {
      mockRecipe = {
        name: "Protein French Toast",
        description: "High protein breakfast",
        ingredients:
          "Croissant bread loaf (10 thick slices)\nSugar free maple syrup\nCinnamon (1 tablespoon)\nEgg whites (3 cups)",
        directions:
          "Dehydrate bread slices overnight.\nPreheat the oven to 350°F.\nMix batter ingredients in blender.",
        notes: "Thick sliced bread will give the best results.",
        categories: ["Breakfast", "Protein", "Low Calorie"],
        rating: 5,
        prep_time: "15 min",
        cook_time: "30 min",
        total_time: "45 min",
        servings: "2",
        difficulty: "Medium",
        source_url: "https://example.com/french-toast",
        photos: [],
      };
    });

    it("converts Paprika recipe to DTO", async () => {
      const dto = await parsePaprikaRecipeToDTO(mockRecipe);

      expect(dto.name).toBe("Protein French Toast");
      expect(dto.description).toBe("High protein breakfast");
      expect(dto.url).toBe("https://example.com/french-toast");
      expect(dto.servings).toBe(2);
      expect(dto.prepMinutes).toBe(15);
      expect(dto.cookMinutes).toBe(30);
      expect(dto.totalMinutes).toBe(45);
    });

    it("splits ingredients by newlines", async () => {
      const dto = await parsePaprikaRecipeToDTO(mockRecipe);

      expect(dto.recipeIngredients).toHaveLength(4);
      expect(dto.recipeIngredients![0].order).toBe(0);
      expect(dto.recipeIngredients![1].order).toBe(1);
    });

    it("splits directions into steps", async () => {
      const dto = await parsePaprikaRecipeToDTO(mockRecipe);

      expect(dto.steps).toHaveLength(3);
      expect(dto.steps![0].step).toBe("Dehydrate bread slices overnight.");
      expect(dto.steps![0].order).toBe(0);
      expect(dto.steps![1].step).toBe("Preheat the oven to 350°F.");
      expect(dto.steps![1].order).toBe(1);
    });

    it("maps categories to tags", async () => {
      const dto = await parsePaprikaRecipeToDTO(mockRecipe);

      expect(dto.tags).toHaveLength(3);
      expect(dto.tags![0].name).toBe("Breakfast");
      expect(dto.tags![1].name).toBe("Protein");
      expect(dto.tags![2].name).toBe("Low Calorie");
    });

    it("maps matched categories into recipe categories", async () => {
      mockRecipe.categories = ["brunch", "quick weeknight dinner ideas", "random"];

      const dto = await parsePaprikaRecipeToDTO(mockRecipe);

      expect(dto.categories).toEqual(["Breakfast", "Dinner"]);
    });

    it("maps nutritional_info to nutrition fields", async () => {
      mockRecipe.nutritional_info =
        "Calories: 443kcal | Carbohydrates: 56g | Protein: 15g | Fat: 19g";

      const dto = await parsePaprikaRecipeToDTO(mockRecipe);

      expect(dto.calories).toBe(443);
      expect(dto.carbs).toBe("56");
      expect(dto.protein).toBe("15");
      expect(dto.fat).toBe("19");
    });

    it("parses various time formats", async () => {
      // Test "1 hr 30 min" format
      mockRecipe.prep_time = "1 hr 30 min";
      mockRecipe.cook_time = "2 hours";
      mockRecipe.total_time = "1h30m";

      const dto = await parsePaprikaRecipeToDTO(mockRecipe);

      expect(dto.prepMinutes).toBe(90);
      expect(dto.cookMinutes).toBe(120);
      expect(dto.totalMinutes).toBe(90);
    });

    it("handles empty time strings", async () => {
      mockRecipe.prep_time = "";
      mockRecipe.cook_time = "";
      mockRecipe.total_time = "";

      const dto = await parsePaprikaRecipeToDTO(mockRecipe);

      expect(dto.prepMinutes).toBeUndefined();
      expect(dto.cookMinutes).toBeUndefined();
      expect(dto.totalMinutes).toBeUndefined();
    });

    it("parses servings as number", async () => {
      mockRecipe.servings = "4";

      const dto = await parsePaprikaRecipeToDTO(mockRecipe);

      expect(dto.servings).toBe(4);
    });

    it("handles empty servings", async () => {
      mockRecipe.servings = "";

      const dto = await parsePaprikaRecipeToDTO(mockRecipe);

      expect(dto.servings).toBeUndefined();
    });

    it("saves image when buffer provided", async () => {
      const imageBuffer = Buffer.from("fake-image-data");
      const dto = await parsePaprikaRecipeToDTO(mockRecipe, imageBuffer);

      expect(dto.image).toBe("mocked-image-guid");
    });

    it("uses source_url over source", async () => {
      mockRecipe.source_url = "https://source-url.com";
      mockRecipe.source = "https://source.com";

      const dto = await parsePaprikaRecipeToDTO(mockRecipe);

      expect(dto.url).toBe("https://source-url.com");
    });

    it("falls back to source when source_url is missing", async () => {
      mockRecipe.source_url = undefined;
      mockRecipe.source = "https://source.com";

      const dto = await parsePaprikaRecipeToDTO(mockRecipe);

      expect(dto.url).toBe("https://source.com");
    });

    it("throws on missing recipe name", async () => {
      mockRecipe.name = "";

      await expect(parsePaprikaRecipeToDTO(mockRecipe)).rejects.toThrow("Missing recipe name");
    });

    it("handles empty ingredients", async () => {
      mockRecipe.ingredients = "";

      const dto = await parsePaprikaRecipeToDTO(mockRecipe);

      expect(dto.recipeIngredients).toHaveLength(0);
    });

    it("handles empty directions", async () => {
      mockRecipe.directions = "";

      const dto = await parsePaprikaRecipeToDTO(mockRecipe);

      expect(dto.steps).toHaveLength(0);
    });

    it("filters empty lines from ingredients and directions", async () => {
      mockRecipe.ingredients = "Flour\n\nSugar\n\n\nButter";
      mockRecipe.directions = "Step 1\n\nStep 2";

      const dto = await parsePaprikaRecipeToDTO(mockRecipe);

      expect(dto.recipeIngredients).toHaveLength(3);
      expect(dto.steps).toHaveLength(2);
    });

    it("handles section headers in ingredients without creating empty ingredient names", async () => {
      mockRecipe.ingredients =
        "1 cup quinoa\nMarinated Chickpeas\n1 can chickpeas\nOptional mix-ins\n1/2 cup vegan feta";

      const dto = await parsePaprikaRecipeToDTO(mockRecipe);
      const ingredientNames = (dto.recipeIngredients || []).map((ingredient) =>
        (ingredient.ingredientName || "").trim()
      );

      expect(ingredientNames.length).toBeGreaterThan(0);
      expect(ingredientNames.every((name) => name.length > 0)).toBe(true);
    });

    it("filters empty categories", async () => {
      mockRecipe.categories = ["Breakfast", "", "Lunch", ""];

      const dto = await parsePaprikaRecipeToDTO(mockRecipe);

      expect(dto.tags).toHaveLength(2);
      expect(dto.tags![0].name).toBe("Breakfast");
      expect(dto.tags![1].name).toBe("Lunch");
    });
  });

  describe("extractPaprikaRecipes", () => {
    it("extracts recipes from gzip-compressed .paprikarecipe files", async () => {
      // Create a gzip-compressed JSON (the real Paprika format)
      const recipeBuffer = await createPaprikaRecipeBuffer({
        name: "Test Recipe",
        description: "Test description",
        categories: ["test"],
        ingredients: "1 cup flour",
        directions: "Mix it",
        photos: [],
      });

      // Create main zip with gzip-compressed .paprikarecipe
      const mainZip = new JSZip();

      mainZip.file("recipe_1.paprikarecipe", recipeBuffer);

      const results = await extractPaprikaRecipes(mainZip);

      expect(results).toHaveLength(1);
      expect(results[0].recipe.name).toBe("Test Recipe");
      expect(results[0].fileName).toBe("recipe_1.paprikarecipe");
      expect(results[0].image).toBeUndefined();
    });

    it("extracts recipe with embedded base64 photo", async () => {
      // Create a small valid base64 image (1x1 red PNG)
      const pngBase64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

      const recipeBuffer = await createPaprikaRecipeBuffer({
        name: "Recipe with Photo",
        photos: [{ data: pngBase64, filename: "photo.png" }],
      });

      const mainZip = new JSZip();

      mainZip.file("recipe_with_photo.paprikarecipe", recipeBuffer);

      const results = await extractPaprikaRecipes(mainZip);

      expect(results).toHaveLength(1);
      expect(results[0].recipe.name).toBe("Recipe with Photo");
      expect(results[0].image).toBeInstanceOf(Buffer);
    });

    it("extracts recipe image from photo_data when photos array is empty", async () => {
      const pngBase64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

      const recipeBuffer = await createPaprikaRecipeBuffer({
        name: "Recipe with photo_data",
        photos: [],
        photo_data: pngBase64,
      });

      const mainZip = new JSZip();

      mainZip.file("recipe_with_photo_data.paprikarecipe", recipeBuffer);

      const results = await extractPaprikaRecipes(mainZip);

      expect(results).toHaveLength(1);
      expect(results[0].recipe.name).toBe("Recipe with photo_data");
      expect(results[0].image).toBeInstanceOf(Buffer);
    });

    it("handles multiple .paprikarecipe files", async () => {
      const mainZip = new JSZip();

      // Create first recipe
      const buffer1 = await createPaprikaRecipeBuffer({ name: "Recipe 1" });

      mainZip.file("recipe_1.paprikarecipe", buffer1);

      // Create second recipe
      const buffer2 = await createPaprikaRecipeBuffer({ name: "Recipe 2" });

      mainZip.file("recipe_2.paprikarecipe", buffer2);

      const results = await extractPaprikaRecipes(mainZip);

      expect(results).toHaveLength(2);
      expect(results[0].recipe.name).toBe("Recipe 1");
      expect(results[1].recipe.name).toBe("Recipe 2");
    });

    it("skips empty gzip file and returns empty array", async () => {
      // Empty gzip (not valid JSON inside)
      const emptyBuffer = await gzipAsync(Buffer.from("", "utf-8"));

      const mainZip = new JSZip();

      mainZip.file("empty.paprikarecipe", emptyBuffer);

      const results = await extractPaprikaRecipes(mainZip);

      expect(results).toHaveLength(0);
    });

    it("skips invalid JSON and returns empty array", async () => {
      const invalidBuffer = await gzipAsync(Buffer.from("invalid json{", "utf-8"));

      const mainZip = new JSZip();

      mainZip.file("invalid.paprikarecipe", invalidBuffer);

      const results = await extractPaprikaRecipes(mainZip);

      expect(results).toHaveLength(0);
    });

    it("handles case-insensitive .paprikarecipe extension", async () => {
      const recipeBuffer = await createPaprikaRecipeBuffer({ name: "Test" });

      const mainZip = new JSZip();

      mainZip.file("recipe.PAPRIKARECIPE", recipeBuffer);

      const results = await extractPaprikaRecipes(mainZip);

      expect(results).toHaveLength(1);
    });

    it("extracts buffer even from invalid base64 photo data (validation happens at save time)", async () => {
      const recipeBuffer = await createPaprikaRecipeBuffer({
        name: "Recipe with Bad Photo",
        photos: [{ data: "not-valid-base64!!!", filename: "photo.png" }],
      });

      const mainZip = new JSZip();

      mainZip.file("recipe.paprikarecipe", recipeBuffer);

      const results = await extractPaprikaRecipes(mainZip);

      expect(results).toHaveLength(1);
      expect(results[0].recipe.name).toBe("Recipe with Bad Photo");
      // Buffer.from(base64) doesn't throw on invalid input, it just decodes what it can
      // The image validation happens later in saveImageBytes when converting to actual image
      expect(results[0].image).toBeInstanceOf(Buffer);
    });

    it("skips non-gzip files (not valid paprikarecipe format)", async () => {
      // Plain JSON without gzip compression should be skipped
      const mainZip = new JSZip();

      mainZip.file("recipe.paprikarecipe", JSON.stringify({ name: "Test" }));

      const results = await extractPaprikaRecipes(mainZip);

      expect(results).toHaveLength(0);
    });
  });
});
