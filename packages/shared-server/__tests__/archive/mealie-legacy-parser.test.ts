import JSZip from "jszip";
import { describe, expect, it, vi } from "vitest";

import type { MealieLegacyRecipe } from "@norish/shared-server/archive/mealie-legacy-parser";
import {
  detectMealieLegacyArchive,
  extractMealieLegacyImage,
  extractMealieLegacyRecipes,
  parseMealieLegacyRecipeToDTO,
} from "@norish/shared-server/archive/mealie-legacy-parser";
import { ArchiveFormat, getArchiveInfo } from "@norish/shared-server/archive/parser";

// @vitest-environment node

vi.mock("@norish/shared-server/media/storage", () => ({
  saveImageBytes: vi.fn().mockResolvedValue("mocked-image-guid"),
}));

vi.mock("@norish/config/server-config-loader", () => ({
  getUnits: vi.fn().mockResolvedValue({}),
}));

/** Helper: minimal legacy recipe JSON */
function createLegacyRecipe(overrides: Partial<MealieLegacyRecipe> = {}): MealieLegacyRecipe {
  return {
    id: "6b4481ee-3259-4ec0-ae71-d75fb2c03554",
    name: "Test Recipe",
    slug: "test-recipe",
    description: "A test recipe",
    org_url: "https://example.com",
    recipe_servings: 4,
    recipe_ingredient: [
      {
        quantity: 0.0,
        unit: null,
        food: null,
        referenced_recipe: null,
        note: "2 cups flour",
        display: "2 cups flour",
        title: "",
        original_text: null,
        reference_id: "ref-1",
      },
      {
        quantity: 0.0,
        unit: null,
        food: null,
        referenced_recipe: null,
        note: "1 tablespoon olive oil",
        display: "1 tablespoon olive oil",
        title: "",
        original_text: null,
        reference_id: "ref-2",
      },
    ],
    recipe_instructions: [
      {
        id: "inst-1",
        title: "",
        summary: null,
        text: "Mix the ingredients together",
        ingredient_references: [],
      },
      {
        id: "inst-2",
        title: "",
        summary: null,
        text: "Bake at 350F for 30 minutes",
        ingredient_references: [],
      },
    ],
    tags: [
      { id: "tag-1", name: "Dinner", slug: "dinner" },
      { id: "tag-2", name: "Healthy", slug: "healthy" },
    ],
    recipe_category: [{ id: "cat-1", name: "Main Course", slug: "main-course" }],
    ...overrides,
  };
}

/** Helper: build a legacy format zip with recipe folders */
function buildLegacyZip(
  recipes: Array<{ slug: string; recipe: MealieLegacyRecipe; imageData?: Buffer }>
): JSZip {
  const zip = new JSZip();

  for (const { slug, recipe, imageData } of recipes) {
    zip.file(`${slug}/${slug}.json`, JSON.stringify(recipe));

    if (imageData) {
      zip.file(`${slug}/images/original.webp`, imageData);
    }
  }

  return zip;
}

describe("Mealie Legacy Parser", () => {
  describe("detectMealieLegacyArchive", () => {
    it("detects legacy format with recipe folders", async () => {
      const zip = buildLegacyZip([
        { slug: "test-recipe", recipe: createLegacyRecipe() },
        {
          slug: "another-recipe",
          recipe: createLegacyRecipe({ id: "recipe-2", name: "Another Recipe" }),
        },
      ]);

      const count = await detectMealieLegacyArchive(zip);

      expect(count).toBe(2);
    });

    it("returns 0 for empty zip", async () => {
      const zip = new JSZip();
      const count = await detectMealieLegacyArchive(zip);

      expect(count).toBe(0);
    });

    it("returns 0 for zip with non-Mealie JSON", async () => {
      const zip = new JSZip();

      zip.file("some-folder/data.json", JSON.stringify({ title: "Not Mealie" }));

      const count = await detectMealieLegacyArchive(zip);

      expect(count).toBe(0);
    });

    it("ignores folders with non-Mealie JSON (e.g. __MACOSX metadata)", async () => {
      const zip = buildLegacyZip([{ slug: "test-recipe", recipe: createLegacyRecipe() }]);

      // __MACOSX metadata isn't a Mealie recipe — detected as a candidate folder
      // but skipped by shape validation during extraction
      zip.file("__MACOSX/test-recipe.json", JSON.stringify({ some: "metadata" }));

      const count = await detectMealieLegacyArchive(zip);

      // Detection returns total candidate count (upper bound)
      expect(count).toBe(2);

      // But extraction only keeps folders with Mealie-shaped JSON
      const recipes = await extractMealieLegacyRecipes(zip);

      expect(recipes).toHaveLength(1);
      expect(recipes[0].recipe.name).toBe("Test Recipe");
    });
  });

  describe("getArchiveInfo (legacy detection)", () => {
    it("detects MEALIE_LEGACY format", async () => {
      const zip = buildLegacyZip([
        { slug: "recipe-a", recipe: createLegacyRecipe() },
        {
          slug: "recipe-b",
          recipe: createLegacyRecipe({ id: "recipe-2", name: "Recipe B" }),
        },
      ]);

      const { format, count } = await getArchiveInfo(zip);

      expect(format).toBe(ArchiveFormat.MEALIE_LEGACY);
      expect(count).toBe(2);
    });

    it("prioritizes database.json Mealie over legacy", async () => {
      const zip = buildLegacyZip([{ slug: "test-recipe", recipe: createLegacyRecipe() }]);

      // Also add database.json (current Mealie format)
      zip.file("database.json", JSON.stringify({ recipes: [{ id: "1" }] }));

      const { format } = await getArchiveInfo(zip);

      expect(format).toBe(ArchiveFormat.MEALIE);
    });
  });

  describe("extractMealieLegacyRecipes", () => {
    it("extracts all recipe JSONs from folders", async () => {
      const zip = buildLegacyZip([
        { slug: "recipe-a", recipe: createLegacyRecipe({ name: "Recipe A" }) },
        {
          slug: "recipe-b",
          recipe: createLegacyRecipe({ id: "recipe-2", name: "Recipe B" }),
        },
      ]);

      const results = await extractMealieLegacyRecipes(zip);

      expect(results).toHaveLength(2);
      expect(results.map((r) => r.recipe.name).sort()).toEqual(["Recipe A", "Recipe B"]);
    });

    it("skips folders with invalid JSON", async () => {
      const zip = buildLegacyZip([{ slug: "good-recipe", recipe: createLegacyRecipe() }]);

      zip.file("bad-recipe/bad-recipe.json", "not valid json");

      const results = await extractMealieLegacyRecipes(zip);

      expect(results).toHaveLength(1);
      expect(results[0].recipe.name).toBe("Test Recipe");
    });

    it("skips recipes with no name and no id", async () => {
      const zip = buildLegacyZip([
        { slug: "good-recipe", recipe: createLegacyRecipe() },
        {
          slug: "empty-recipe",
          recipe: { ...createLegacyRecipe(), id: "", name: "" },
        },
      ]);

      const results = await extractMealieLegacyRecipes(zip);

      expect(results).toHaveLength(1);
    });
  });

  describe("extractMealieLegacyImage", () => {
    it("extracts original.webp from images folder", async () => {
      const imageData = Buffer.from("fake-webp-image-data");
      const zip = buildLegacyZip([
        { slug: "test-recipe", recipe: createLegacyRecipe(), imageData },
      ]);

      const buffer = await extractMealieLegacyImage(zip, "test-recipe");

      expect(buffer).toBeDefined();
      expect(buffer!.toString()).toBe("fake-webp-image-data");
    });

    it("falls back to min-original.webp", async () => {
      const zip = new JSZip();

      zip.file("test-recipe/test-recipe.json", JSON.stringify(createLegacyRecipe()));
      zip.file("test-recipe/images/min-original.webp", Buffer.from("min-image"));

      const buffer = await extractMealieLegacyImage(zip, "test-recipe");

      expect(buffer).toBeDefined();
      expect(buffer!.toString()).toBe("min-image");
    });

    it("falls back to tiny-original.webp", async () => {
      const zip = new JSZip();

      zip.file("test-recipe/test-recipe.json", JSON.stringify(createLegacyRecipe()));
      zip.file("test-recipe/images/tiny-original.webp", Buffer.from("tiny-image"));

      const buffer = await extractMealieLegacyImage(zip, "test-recipe");

      expect(buffer).toBeDefined();
      expect(buffer!.toString()).toBe("tiny-image");
    });

    it("supports .jpg extension", async () => {
      const zip = new JSZip();

      zip.file("test-recipe/test-recipe.json", JSON.stringify(createLegacyRecipe()));
      zip.file("test-recipe/images/original.jpg", Buffer.from("jpg-image"));

      const buffer = await extractMealieLegacyImage(zip, "test-recipe");

      expect(buffer).toBeDefined();
      expect(buffer!.toString()).toBe("jpg-image");
    });

    it("supports .png extension", async () => {
      const zip = new JSZip();

      zip.file("test-recipe/test-recipe.json", JSON.stringify(createLegacyRecipe()));
      zip.file("test-recipe/images/original.png", Buffer.from("png-image"));

      const buffer = await extractMealieLegacyImage(zip, "test-recipe");

      expect(buffer).toBeDefined();
      expect(buffer!.toString()).toBe("png-image");
    });

    it("returns undefined when no images exist", async () => {
      const zip = buildLegacyZip([{ slug: "test-recipe", recipe: createLegacyRecipe() }]);

      const buffer = await extractMealieLegacyImage(zip, "test-recipe");

      expect(buffer).toBeUndefined();
    });

    it("prefers original over min-original", async () => {
      const zip = new JSZip();

      zip.file("test-recipe/images/original.webp", Buffer.from("original"));
      zip.file("test-recipe/images/min-original.webp", Buffer.from("min"));

      const buffer = await extractMealieLegacyImage(zip, "test-recipe");

      expect(buffer!.toString()).toBe("original");
    });

    it("supports .avif extension", async () => {
      const zip = new JSZip();

      zip.file("test-recipe/test-recipe.json", JSON.stringify(createLegacyRecipe()));
      zip.file("test-recipe/images/original.avif", Buffer.from("avif-image"));

      const buffer = await extractMealieLegacyImage(zip, "test-recipe");

      expect(buffer).toBeDefined();
      expect(buffer!.toString()).toBe("avif-image");
    });
  });

  describe("parseMealieLegacyRecipeToDTO", () => {
    it("converts a legacy recipe to DTO", async () => {
      const recipe = createLegacyRecipe();
      const dto = await parseMealieLegacyRecipeToDTO(
        recipe,
        "123e4567-e89b-42d3-a456-426614174000"
      );

      expect(dto).not.toBeNull();
      expect(dto.name).toBe("Test Recipe");
      expect(dto.description).toBe("A test recipe");
      expect(dto.url).toBe("https://example.com");
      expect(dto.servings).toBe(4);
    });

    it("parses unparsed ingredients from note field", async () => {
      const recipe = createLegacyRecipe();
      const dto = await parseMealieLegacyRecipeToDTO(
        recipe,
        "123e4567-e89b-42d3-a456-426614174000"
      );

      expect(dto.recipeIngredients).toHaveLength(2);
      expect(dto.recipeIngredients![0].ingredientName).toBe("flour");
      expect(dto.recipeIngredients![0].amount).toBe(2);
      expect(dto.recipeIngredients![0].unit).toBe("cup");
      expect(dto.recipeIngredients![1].ingredientName).toBe("olive oil");
      expect(dto.recipeIngredients![1].amount).toBe(1);
      expect(dto.recipeIngredients![1].unit).toBe("tablespoon");
    });

    it("maps instructions preserving order", async () => {
      const recipe = createLegacyRecipe();
      const dto = await parseMealieLegacyRecipeToDTO(
        recipe,
        "123e4567-e89b-42d3-a456-426614174000"
      );

      expect(dto.steps).toHaveLength(2);
      expect(dto.steps![0].step).toBe("Mix the ingredients together");
      expect(dto.steps![1].step).toBe("Bake at 350F for 30 minutes");
    });

    it("resolves inline tags and categories", async () => {
      const recipe = createLegacyRecipe();
      const dto = await parseMealieLegacyRecipeToDTO(
        recipe,
        "123e4567-e89b-42d3-a456-426614174000"
      );

      expect(dto.tags).toHaveLength(3); // 2 tags + 1 category
      const tagNames = dto.tags!.map((t) => t.name);

      expect(tagNames).toContain("Dinner");
      expect(tagNames).toContain("Healthy");
      expect(tagNames).toContain("Main Course");
    });

    it("deduplicates tags and categories by name", async () => {
      const recipe = createLegacyRecipe({
        tags: [{ id: "tag-1", name: "Dinner", slug: "dinner" }],
        recipe_category: [{ id: "cat-1", name: "dinner", slug: "dinner" }], // same name, different case
      });

      const dto = await parseMealieLegacyRecipeToDTO(
        recipe,
        "123e4567-e89b-42d3-a456-426614174000"
      );

      expect(dto.tags).toHaveLength(1);
      expect(dto.tags![0].name).toBe("Dinner");
    });

    it("handles recipe with image buffer", async () => {
      const recipe = createLegacyRecipe();
      const imageBuffer = Buffer.from("fake-image-data");
      const dto = await parseMealieLegacyRecipeToDTO(
        recipe,
        "123e4567-e89b-42d3-a456-426614174000",
        imageBuffer
      );

      expect(dto.image).toBe("mocked-image-guid");
    });

    it("handles recipe with no tags or categories", async () => {
      const recipe = createLegacyRecipe({ tags: [], recipe_category: [] });
      const dto = await parseMealieLegacyRecipeToDTO(
        recipe,
        "123e4567-e89b-42d3-a456-426614174000"
      );

      expect(dto.tags).toHaveLength(0);
    });

    it("handles nutrition data", async () => {
      const recipe = createLegacyRecipe({
        nutrition: {
          calories: "350",
          fat_content: "15",
          protein_content: "25",
          carbohydrate_content: "30",
        },
      });

      const dto = await parseMealieLegacyRecipeToDTO(
        recipe,
        "123e4567-e89b-42d3-a456-426614174000"
      );

      expect(dto.calories).toBe(350);
      expect(dto.fat).toBe("15");
      expect(dto.protein).toBe("25");
      expect(dto.carbs).toBe("30");
    });

    it("handles inline food and unit objects", async () => {
      const recipe = createLegacyRecipe({
        recipe_ingredient: [
          {
            quantity: 2,
            unit: { id: "unit-1", name: "cup" },
            food: { id: "food-1", name: "flour" },
            referenced_recipe: null,
            note: "",
            display: "2 cups flour",
            title: "",
            original_text: null,
            reference_id: "ref-1",
          },
        ],
      });

      const dto = await parseMealieLegacyRecipeToDTO(
        recipe,
        "123e4567-e89b-42d3-a456-426614174000"
      );

      expect(dto.recipeIngredients).toHaveLength(1);
      expect(dto.recipeIngredients![0].ingredientName).toBe("flour");
      expect(dto.recipeIngredients![0].amount).toBe(2);
      expect(dto.recipeIngredients![0].unit).toBe("cup");
    });

    it("throws for recipe with no name", async () => {
      const recipe = createLegacyRecipe({ name: "" });

      await expect(
        parseMealieLegacyRecipeToDTO(recipe, "123e4567-e89b-42d3-a456-426614174000")
      ).rejects.toThrow("Missing recipe name");
    });

    it("matches the user-provided chicken shawarma example", async () => {
      const shawarmaRecipe: MealieLegacyRecipe = {
        id: "6b4481ee-3259-4ec0-ae71-d75fb2c03554",
        name: "Homemade Chicken Shawarma",
        slug: "homemade-chicken-shawarma",
        description: "A delicious chicken shawarma recipe",
        org_url: "https://www.instagram.com/reel/C2yTnDMuaRk/",
        recipe_servings: 0,
        recipe_yield_quantity: 0,
        recipe_ingredient: [
          {
            quantity: 0.0,
            unit: null,
            food: null,
            referenced_recipe: null,
            note: "2.5 lbs of boneless chicken thighs",
            display: "2.5 lbs of boneless chicken thighs",
            title: "",
            original_text: null,
            reference_id: "ref-1",
          },
          {
            quantity: 0.0,
            unit: null,
            food: null,
            referenced_recipe: null,
            note: "2-3 tablespoons olive oil",
            display: "2-3 tablespoons olive oil",
            title: "",
            original_text: null,
            reference_id: "ref-2",
          },
        ],
        recipe_instructions: [
          {
            id: "f896cb38-c6eb-4413-9e14-dd07354791b2",
            title: "",
            summary: null,
            text: "Start with 2.5 lbs of boneless chicken thighs.",
            ingredient_references: [],
          },
          {
            id: "c503b071-48b8-4216-bb12-ae03a33222df",
            title: "",
            summary: null,
            text: "Season the chicken well.",
            ingredient_references: [],
          },
        ],
        tags: [
          { id: "tag-1", name: "Healthy", slug: "healthy" },
          { id: "tag-2", name: "Chicken", slug: "chicken" },
        ],
        recipe_category: [{ id: "cat-1", name: "Dinner", slug: "dinner" }],
      };

      const dto = await parseMealieLegacyRecipeToDTO(
        shawarmaRecipe,
        "123e4567-e89b-42d3-a456-426614174000"
      );

      expect(dto.name).toBe("Homemade Chicken Shawarma");
      expect(dto.url).toBe("https://www.instagram.com/reel/C2yTnDMuaRk/");
      expect(dto.recipeIngredients).toHaveLength(2);
      expect(dto.steps).toHaveLength(2);
      expect(dto.tags!.map((t) => t.name).sort()).toEqual(["Chicken", "Dinner", "Healthy"]);
    });
  });
});
