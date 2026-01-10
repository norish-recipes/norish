// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

import { normalizeRecipeFromJson } from "@/server/parser/normalize";

// Mock dependencies
vi.mock("@/server/downloader", () => ({
  downloadAllImagesFromJsonLd: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/config/server-config-loader", () => ({
  getUnits: vi.fn().mockResolvedValue({}),
}));

describe("normalizeRecipeFromJson - HTML Entity Decoding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("ingredient HTML entity decoding", () => {
    it("decodes en dash (&#8211;) in ingredient array and keeps comments", async () => {
      const json = {
        name: "Test Recipe",
        recipeIngredient: [
          "1 cup plain Greek Yogurt &#8211; I used nonfat",
          "1/2 English cucumber &#8211; seeds removed",
        ],
        recipeInstructions: ["Mix well"],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      expect(result?.recipeIngredients).toHaveLength(2);
      // Should decode entity and keep comment
      const first = result?.recipeIngredients?.[0];
      const second = result?.recipeIngredients?.[1];

      expect(first?.ingredientName).toContain("–"); // en dash
      expect(first?.ingredientName).toContain("nonfat");
      expect(first?.ingredientName).not.toContain("&#8211;");
      expect(second?.ingredientName).toContain("–");
      expect(second?.ingredientName).toContain("seeds removed");
    });

    it("decodes apostrophe (&#39;) in ingredients", async () => {
      const json = {
        name: "Test Recipe",
        recipeIngredient: ["2 cups baker&#39;s sugar"],
        recipeInstructions: ["Mix"],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      const ingredient = result?.recipeIngredients?.[0];

      expect(ingredient?.ingredientName).toContain("'");
      expect(ingredient?.ingredientName).not.toContain("&#39;");
    });

    it("decodes smart quotes (&#8220;/&#8221;) in ingredients", async () => {
      const json = {
        name: "Test Recipe",
        recipeIngredient: ["1 cup &#8220;raw&#8221; sugar"],
        recipeInstructions: ["Mix"],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      const ingredient = result?.recipeIngredients?.[0];

      expect(ingredient?.ingredientName).toContain("\u201C");
      expect(ingredient?.ingredientName).toContain("\u201D");
      expect(ingredient?.ingredientName).not.toContain("&#8220;");
    });

    it("decodes multiple entity types in single ingredient", async () => {
      const json = {
        name: "Test Recipe",
        recipeIngredient: ["1 cup &#8220;baker&#39;s&#8221; flour &#8211; sifted"],
        recipeInstructions: ["Mix"],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      const ingredient = result?.recipeIngredients?.[0];

      expect(ingredient?.ingredientName).toContain("\u201C");
      expect(ingredient?.ingredientName).toContain("'");
      expect(ingredient?.ingredientName).toContain("–");
      expect(ingredient?.ingredientName).toContain("sifted");
    });

    it("handles string ingredient (not array) with entities", async () => {
      const json = {
        name: "Test Recipe",
        recipeIngredient: "1 cup flour &#8211; sifted",
        recipeInstructions: ["Mix"],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      const ingredient = result?.recipeIngredients?.[0];

      expect(ingredient?.ingredientName).toContain("–");
      expect(ingredient?.ingredientName).toContain("sifted");
    });

    it("preserves ingredients without entities", async () => {
      const json = {
        name: "Test Recipe",
        recipeIngredient: ["1 cup flour", "2 eggs"],
        recipeInstructions: ["Mix"],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      expect(result?.recipeIngredients?.[0]?.ingredientName).toBe("flour");
      expect(result?.recipeIngredients?.[1]?.ingredientName).toContain("egg");
    });

    it("decodes degree symbol (&#176;) in ingredients", async () => {
      const json = {
        name: "Test Recipe",
        recipeIngredient: ["Water heated to 180&#176;F"],
        recipeInstructions: ["Mix"],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      const ingredient = result?.recipeIngredients?.[0];

      expect(ingredient?.ingredientName).toContain("°");
      expect(ingredient?.ingredientName).not.toContain("&#176;");
    });
  });

  describe("step HTML entity decoding", () => {
    it("decodes en dash (&#8211;) in instruction strings", async () => {
      const json = {
        name: "Test Recipe",
        recipeIngredient: ["1 cup flour"],
        recipeInstructions: ["Preheat oven to 350&#176;F &#8211; use convection if available"],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      expect(result?.steps).toHaveLength(1);
      const step = result?.steps?.[0];

      expect(step?.step).toContain("–");
      expect(step?.step).toContain("°");
      expect(step?.step).toContain("use convection if available");
      expect(step?.step).not.toContain("&#8211;");
      expect(step?.step).not.toContain("&#176;");
    });

    it("decodes entities in HowToStep text field", async () => {
      const json = {
        name: "Test Recipe",
        recipeIngredient: ["1 cup flour"],
        recipeInstructions: [
          {
            "@type": "HowToStep",
            text: "Mix until it&#39;s smooth &#8211; about 2 minutes",
          },
        ],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      const step = result?.steps?.[0];

      expect(step?.step).toContain("'");
      expect(step?.step).toContain("–");
      expect(step?.step).toContain("about 2 minutes");
      expect(step?.step).not.toContain("&#39;");
    });

    it("decodes entities in HowToStep name field", async () => {
      const json = {
        name: "Test Recipe",
        recipeIngredient: ["1 cup flour"],
        recipeInstructions: [
          {
            "@type": "HowToStep",
            name: "Heat oven to 180&#176;C &#8211; gas mark 4",
          },
        ],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      const step = result?.steps?.[0];

      expect(step?.step).toContain("°");
      expect(step?.step).toContain("–");
      expect(step?.step).toContain("gas mark 4");
    });

    it("decodes entities in nested HowToStep structures", async () => {
      const json = {
        name: "Test Recipe",
        recipeIngredient: ["1 cup flour"],
        recipeInstructions: {
          "@type": "HowToSection",
          itemListElement: [
            {
              "@type": "HowToStep",
              text: "Bake for 30&#8211;35 minutes",
            },
          ],
        },
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      const step = result?.steps?.[0];

      expect(step?.step).toContain("–");
      expect(step?.step).not.toContain("&#8211;");
    });

    it("handles mixed string and object instructions", async () => {
      const json = {
        name: "Test Recipe",
        recipeIngredient: ["1 cup flour"],
        recipeInstructions: [
          "Preheat oven &#8211; 350&#176;F",
          {
            "@type": "HowToStep",
            text: "Mix it&#39;s all together",
          },
        ],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      expect(result?.steps).toHaveLength(2);
      expect(result?.steps?.[0]?.step).toContain("–");
      expect(result?.steps?.[0]?.step).toContain("°");
      expect(result?.steps?.[1]?.step).toContain("'");
    });
  });

  describe("edge cases", () => {
    it("handles empty ingredients array", async () => {
      const json = {
        name: "Test Recipe",
        recipeIngredient: [],
        recipeInstructions: ["Mix"],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      expect(result?.recipeIngredients).toHaveLength(0);
    });

    it("handles missing recipeIngredient field", async () => {
      const json = {
        name: "Test Recipe",
        recipeInstructions: ["Mix"],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      expect(result?.recipeIngredients).toHaveLength(0);
    });

    it("handles null/undefined ingredient values", async () => {
      const json = {
        name: "Test Recipe",
        recipeIngredient: [null, undefined, "", "1 cup flour"],
        recipeInstructions: ["Mix"],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      expect(result?.recipeIngredients?.length).toBeGreaterThan(0);
    });

    it("decodes numeric entities (&#NNN;)", async () => {
      const json = {
        name: "Test Recipe",
        recipeIngredient: ["100g sm&#248;r"],
        recipeInstructions: ["R&#248;r godt"],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      expect(result?.recipeIngredients?.[0]?.ingredientName).toContain("ø");
      expect(result?.steps?.[0]?.step).toContain("ø");
    });

    it("decodes hex entities (&#xHH;)", async () => {
      const json = {
        name: "Test Recipe",
        recipeIngredient: ["caf&#xe9; au lait"],
        recipeInstructions: ["Enjoy your caf&#xe9;"],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      expect(result?.recipeIngredients?.[0]?.ingredientName).toContain("é");
      expect(result?.steps?.[0]?.step).toContain("é");
    });

    it("handles named HTML entities", async () => {
      const json = {
        name: "Test Recipe",
        recipeIngredient: ["Salt &amp; Pepper"],
        recipeInstructions: ["Mix &lt; 5 minutes"],
      };

      const result = await normalizeRecipeFromJson(json);

      expect(result).not.toBeNull();
      expect(result?.recipeIngredients?.[0]?.ingredientName).toContain("&");
      expect(result?.steps?.[0]?.step).toContain("<");
    });
  });
});
