/**
 * @vitest-environment node
 */
import type { RecipeExtractionOutput } from "@/server/ai/schemas/recipe.schema";
import type { FullRecipeInsertDTO } from "@/types/dto/recipe";

import { describe, it, expect, vi } from "vitest";

import {
  validateExtractionOutput,
  getExtractionLogContext,
  normalizeExtractionOutput,
} from "@/server/ai/features/recipe-extraction/normalizer";

// Mock the normalizeExtractionOutput dependencies for isolation
vi.mock("@/server/parser/normalize", () => ({
  normalizeRecipeFromJson: vi.fn(),
}));

vi.mock("@/config/server-config-loader", () => ({
  getUnits: vi.fn().mockResolvedValue([]),
}));

describe("validateExtractionOutput", () => {
  describe("when output is null or empty", () => {
    it("returns invalid for null output", () => {
      const result = validateExtractionOutput(null);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("AI returned empty response");
    });

    it("returns invalid for empty object", () => {
      const result = validateExtractionOutput({} as RecipeExtractionOutput);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("AI returned empty response");
    });
  });

  describe("when output is missing required fields", () => {
    it("returns invalid when name is missing", () => {
      const output = createPartialOutput({ name: undefined as unknown as string });
      const result = validateExtractionOutput(output);

      expect(result.valid).toBe(false);
      expect(result.error).toBe("Recipe extraction failed - missing required fields");
      expect(result.details?.hasName).toBe(false);
    });

    it("returns invalid when metric ingredients are missing", () => {
      const output = createPartialOutput({
        recipeIngredient: { metric: [], us: ["1 cup flour"] },
      });
      const result = validateExtractionOutput(output);

      expect(result.valid).toBe(false);
      expect(result.details?.metricIngredients).toBe(0);
      expect(result.details?.usIngredients).toBe(1);
    });

    it("returns invalid when US ingredients are missing", () => {
      const output = createPartialOutput({
        recipeIngredient: { metric: ["100g flour"], us: [] },
      });
      const result = validateExtractionOutput(output);

      expect(result.valid).toBe(false);
      expect(result.details?.metricIngredients).toBe(1);
      expect(result.details?.usIngredients).toBe(0);
    });

    it("returns invalid when metric steps are missing", () => {
      const output = createPartialOutput({
        recipeInstructions: { metric: [], us: ["Mix well"] },
      });
      const result = validateExtractionOutput(output);

      expect(result.valid).toBe(false);
      expect(result.details?.metricSteps).toBe(0);
      expect(result.details?.usSteps).toBe(1);
    });

    it("returns invalid when US steps are missing", () => {
      const output = createPartialOutput({
        recipeInstructions: { metric: ["Mix well"], us: [] },
      });
      const result = validateExtractionOutput(output);

      expect(result.valid).toBe(false);
      expect(result.details?.metricSteps).toBe(1);
      expect(result.details?.usSteps).toBe(0);
    });
  });

  describe("when output has all required fields", () => {
    it("returns valid for complete output", () => {
      const output = createValidOutput();
      const result = validateExtractionOutput(output);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.details).toEqual({
        hasName: true,
        metricIngredients: 2,
        usIngredients: 2,
        metricSteps: 2,
        usSteps: 2,
      });
    });

    it("includes correct details for single-item arrays", () => {
      const output = createPartialOutput({
        recipeIngredient: { metric: ["100g flour"], us: ["1 cup flour"] },
        recipeInstructions: { metric: ["Mix well"], us: ["Mix well"] },
      });
      const result = validateExtractionOutput(output);

      expect(result.valid).toBe(true);
      expect(result.details?.metricIngredients).toBe(1);
      expect(result.details?.usIngredients).toBe(1);
      expect(result.details?.metricSteps).toBe(1);
      expect(result.details?.usSteps).toBe(1);
    });
  });
});

describe("getExtractionLogContext", () => {
  it("returns basic context when normalized is null", () => {
    const output = createValidOutput();
    const context = getExtractionLogContext(output, null);

    expect(context).toEqual({
      recipeName: "Chocolate Cake",
      categories: null,
      metricIngredients: 2,
      usIngredients: 2,
      metricSteps: 2,
      usSteps: 2,
    });
  });

  it("includes normalized recipe details when available", () => {
    const output = createValidOutput();
    const normalized: Partial<FullRecipeInsertDTO> = {
      recipeIngredients: [
        {
          ingredientId: null,
          ingredientName: "flour",
          amount: 100,
          unit: "g",
          systemUsed: "metric",
          order: 0,
        },
        {
          ingredientId: null,
          ingredientName: "sugar",
          amount: 50,
          unit: "g",
          systemUsed: "metric",
          order: 1,
        },
        {
          ingredientId: null,
          ingredientName: "flour",
          amount: 1,
          unit: "cup",
          systemUsed: "us",
          order: 0,
        },
        {
          ingredientId: null,
          ingredientName: "sugar",
          amount: 0.5,
          unit: "cup",
          systemUsed: "us",
          order: 1,
        },
      ],
      steps: [
        { step: "Mix dry ingredients", order: 1, systemUsed: "metric", images: [] },
        { step: "Bake at 180C", order: 2, systemUsed: "metric", images: [] },
        { step: "Mix dry ingredients", order: 1, systemUsed: "us", images: [] },
        { step: "Bake at 350F", order: 2, systemUsed: "us", images: [] },
      ],
      systemUsed: "metric",
      tags: [{ name: "dessert" }, { name: "chocolate" }],
    };

    const context = getExtractionLogContext(output, normalized as FullRecipeInsertDTO);

    expect(context).toEqual({
      recipeName: "Chocolate Cake",
      categories: null,
      metricIngredients: 2,
      usIngredients: 2,
      metricSteps: 2,
      usSteps: 2,
      totalIngredients: 4,
      totalSteps: 4,
      systemUsed: "metric",
      tags: [{ name: "dessert" }, { name: "chocolate" }],
    });
  });

  it("handles missing arrays in output gracefully", () => {
    const output = {
      "@context": "https://schema.org",
      "@type": "Recipe",
      name: "Test Recipe",
      description: null,
      recipeYield: null,
      prepTime: null,
      cookTime: null,
      totalTime: null,
      recipeIngredient: undefined,
      recipeInstructions: undefined,
      keywords: null,
      categories: null,
      nutrition: { calories: 0, fat: 0, carbs: 0, protein: 0 },
    } as unknown as RecipeExtractionOutput;

    const context = getExtractionLogContext(output, null);

    expect(context).toEqual({
      recipeName: "Test Recipe",
      categories: null,
      metricIngredients: 0,
      usIngredients: 0,
      metricSteps: 0,
      usSteps: 0,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Helpers
// ─────────────────────────────────────────────────────────────────────────────

function createValidOutput(): RecipeExtractionOutput {
  return {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: "Chocolate Cake",
    description: "A delicious chocolate cake",
    recipeIngredient: {
      metric: ["100g flour", "50g sugar"],
      us: ["1 cup flour", "1/2 cup sugar"],
    },
    recipeInstructions: {
      metric: ["Mix dry ingredients", "Bake at 180C for 30 minutes"],
      us: ["Mix dry ingredients", "Bake at 350F for 30 minutes"],
    },
    recipeYield: "8 servings",
    cookTime: "PT30M",
    prepTime: "PT15M",
    totalTime: "PT45M",
    keywords: [],
    categories: null,
    nutrition: {
      calories: 350,
      fat: 12,
      carbs: 45,
      protein: 6,
    },
  };
}

function createPartialOutput(overrides: Partial<RecipeExtractionOutput>): RecipeExtractionOutput {
  return {
    ...createValidOutput(),
    ...overrides,
  } as RecipeExtractionOutput;
}

describe("normalizeExtractionOutput - HTML Entity Decoding", () => {
  it("normalizes categories with matcher", async () => {
    const output: RecipeExtractionOutput = {
      "@context": "https://schema.org",
      "@type": "Recipe",
      name: "Test Recipe",
      description: "Test",
      recipeIngredient: {
        metric: ["100g flour"],
        us: ["1 cup flour"],
      },
      recipeInstructions: {
        metric: ["Mix well"],
        us: ["Mix well"],
      },
      recipeYield: "4",
      cookTime: null,
      prepTime: null,
      totalTime: null,
      keywords: [],
      categories: ["Brunch", "gibberish", "dinner", "Breakfast"],
      nutrition: { calories: 0, fat: 0, carbs: 0, protein: 0 },
    };

    const { normalizeRecipeFromJson } = await import("@/server/parser/normalize");

    vi.mocked(normalizeRecipeFromJson).mockResolvedValue({
      name: "Test Recipe",
      description: "Test",
      url: null,
      image: undefined,
      servings: undefined,
      prepMinutes: undefined,
      cookMinutes: undefined,
      totalMinutes: undefined,
      calories: null,
      fat: null,
      carbs: null,
      protein: null,
      recipeIngredients: [],
      steps: [],
      systemUsed: "metric",
      tags: [],
      images: [],
      categories: [],
    } as any);

    const result = await normalizeExtractionOutput(output);

    expect(result?.categories).toEqual(["Breakfast", "Dinner"]);
  });

  it("decodes HTML entities in US ingredients and keeps comments", async () => {
    const output: RecipeExtractionOutput = {
      "@context": "https://schema.org",
      "@type": "Recipe",
      name: "Test Recipe",
      description: "Test",
      recipeIngredient: {
        metric: ["100g flour"],
        us: ["1 cup flour &#8211; all-purpose", "2 eggs &#8211; beaten"],
      },
      recipeInstructions: {
        metric: ["Mix well"],
        us: ["Mix well"],
      },
      recipeYield: "4",
      cookTime: null,
      prepTime: null,
      totalTime: null,
      keywords: [],
      categories: null,
      nutrition: { calories: 0, fat: 0, carbs: 0, protein: 0 },
    };

    // Mock normalizeRecipeFromJson to return metric version
    const { normalizeRecipeFromJson } = await import("@/server/parser/normalize");

    vi.mocked(normalizeRecipeFromJson).mockResolvedValue({
      name: "Test Recipe",
      description: "Test",
      url: null,
      image: undefined,
      servings: undefined,
      prepMinutes: undefined,
      cookMinutes: undefined,
      totalMinutes: undefined,
      calories: null,
      fat: null,
      carbs: null,
      protein: null,
      recipeIngredients: [
        {
          ingredientId: null,
          ingredientName: "flour",
          amount: 100,
          unit: "g",
          systemUsed: "metric",
          order: 0,
        },
      ],
      steps: [{ step: "Mix well", order: 1, systemUsed: "metric", images: [] }],
      systemUsed: "metric",
      tags: [],
      images: [],
    } as any);

    const result = await normalizeExtractionOutput(output);

    expect(result).toBeTruthy();
    // Check US ingredients were decoded (with &#8211;)
    const usIngredients = result?.recipeIngredients?.filter((ing) => ing.systemUsed === "us");

    expect(usIngredients).toHaveLength(2);
    expect(usIngredients?.[0].ingredientName).toContain("–"); // en dash
    expect(usIngredients?.[0].ingredientName).toContain("all-purpose"); // comment preserved
    expect(usIngredients?.[0].ingredientName).not.toContain("&#8211;");
    expect(usIngredients?.[1].ingredientName).toContain("–");
    expect(usIngredients?.[1].ingredientName).toContain("beaten");
  });

  it("decodes HTML entities in US steps and keeps full text", async () => {
    const output: RecipeExtractionOutput = {
      "@context": "https://schema.org",
      "@type": "Recipe",
      name: "Test Recipe",
      description: "Test",
      recipeIngredient: {
        metric: ["100g flour"],
        us: ["1 cup flour"],
      },
      recipeInstructions: {
        metric: ["Mix well"],
        us: [
          "Bake at 350&#176;F &#8211; use convection",
          "Cool for 10 minutes &#8211; don&#39;t rush",
        ],
      },
      recipeYield: "4",
      cookTime: null,
      prepTime: null,
      totalTime: null,
      keywords: [],
      categories: null,
      nutrition: { calories: 0, fat: 0, carbs: 0, protein: 0 },
    };

    const { normalizeRecipeFromJson } = await import("@/server/parser/normalize");

    vi.mocked(normalizeRecipeFromJson).mockResolvedValue({
      name: "Test Recipe",
      description: "Test",
      url: null,
      image: undefined,
      servings: undefined,
      prepMinutes: undefined,
      cookMinutes: undefined,
      totalMinutes: undefined,
      calories: null,
      fat: null,
      carbs: null,
      protein: null,
      recipeIngredients: [],
      steps: [{ step: "Mix well", order: 1, systemUsed: "metric", images: [] }],
      systemUsed: "metric",
      tags: [],
      images: [],
    } as any);

    const result = await normalizeExtractionOutput(output);

    const usSteps = result?.steps?.filter((s) => s.systemUsed === "us");

    expect(usSteps).toHaveLength(2);
    expect(usSteps?.[0].step).toContain("°"); // degree symbol
    expect(usSteps?.[0].step).toContain("–"); // en dash
    expect(usSteps?.[0].step).toContain("use convection"); // comment preserved
    expect(usSteps?.[0].step).not.toContain("&#176;");
    expect(usSteps?.[0].step).not.toContain("&#8211;");
    expect(usSteps?.[1].step).toContain("'"); // apostrophe
    expect(usSteps?.[1].step).toContain("don't rush");
    expect(usSteps?.[1].step).not.toContain("&#39;");
  });

  it("decodes multiple entity types in US content", async () => {
    const output: RecipeExtractionOutput = {
      "@context": "https://schema.org",
      "@type": "Recipe",
      name: "Test Recipe",
      description: "Test",
      recipeIngredient: {
        metric: ["100g flour"],
        us: ["1 cup &#8220;baker&#39;s&#8221; flour &#8211; premium grade"],
      },
      recipeInstructions: {
        metric: ["Mix"],
        us: ["It&#39;s ready when it&#8217;s smooth &#8211; about 5 minutes"],
      },
      recipeYield: "4",
      cookTime: null,
      prepTime: null,
      totalTime: null,
      keywords: [],
      categories: null,
      nutrition: { calories: 0, fat: 0, carbs: 0, protein: 0 },
    };

    const { normalizeRecipeFromJson } = await import("@/server/parser/normalize");

    vi.mocked(normalizeRecipeFromJson).mockResolvedValue({
      name: "Test Recipe",
      description: "Test",
      url: null,
      image: undefined,
      servings: undefined,
      prepMinutes: undefined,
      cookMinutes: undefined,
      totalMinutes: undefined,
      calories: null,
      fat: null,
      carbs: null,
      protein: null,
      recipeIngredients: [],
      steps: [],
      systemUsed: "metric",
      tags: [],
      images: [],
    } as any);

    const result = await normalizeExtractionOutput(output);

    const usIngredient = result?.recipeIngredients?.find((ing) => ing.systemUsed === "us");

    expect(usIngredient?.ingredientName).toContain("\u201C"); // left double quote
    expect(usIngredient?.ingredientName).toContain("'"); // apostrophe
    expect(usIngredient?.ingredientName).toContain("\u201D"); // right double quote
    expect(usIngredient?.ingredientName).toContain("–"); // en dash
    expect(usIngredient?.ingredientName).toContain("premium grade");

    const usStep = result?.steps?.find((s) => s.systemUsed === "us");

    expect(usStep?.step).toContain("'"); // apostrophe (It's)
    expect(usStep?.step).toContain("\u2019"); // right single quote (it's)
    expect(usStep?.step).toContain("–"); // en dash
    expect(usStep?.step).toContain("about 5 minutes");
  });

  it("handles US ingredients without entities", async () => {
    const output: RecipeExtractionOutput = {
      "@context": "https://schema.org",
      "@type": "Recipe",
      name: "Test Recipe",
      description: "Test",
      recipeIngredient: {
        metric: ["100g flour"],
        us: ["1 cup flour", "2 eggs"],
      },
      recipeInstructions: {
        metric: ["Mix well"],
        us: ["Mix well"],
      },
      recipeYield: "4",
      cookTime: null,
      prepTime: null,
      totalTime: null,
      keywords: [],
      categories: null,
      nutrition: { calories: 0, fat: 0, carbs: 0, protein: 0 },
    };

    const { normalizeRecipeFromJson } = await import("@/server/parser/normalize");

    vi.mocked(normalizeRecipeFromJson).mockResolvedValue({
      name: "Test Recipe",
      description: "Test",
      url: null,
      image: undefined,
      servings: undefined,
      prepMinutes: undefined,
      cookMinutes: undefined,
      totalMinutes: undefined,
      calories: null,
      fat: null,
      carbs: null,
      protein: null,
      recipeIngredients: [],
      steps: [],
      systemUsed: "metric",
      tags: [],
      images: [],
    } as any);

    const result = await normalizeExtractionOutput(output);

    const usIngredients = result?.recipeIngredients?.filter((ing) => ing.systemUsed === "us");

    expect(usIngredients).toHaveLength(2);
    // Plain text should pass through unchanged
    expect(usIngredients?.[0].ingredientName).toBe("flour");
    expect(usIngredients?.[1].ingredientName).toContain("egg");
  });

  it("maps and decodes notes from AI output", async () => {
    const output: RecipeExtractionOutput = {
      "@context": "https://schema.org",
      "@type": "Recipe",
      name: "Test Recipe",
      description: "Test",
      notes: "Let it rest for 10 minutes &#8211; don&#39;t skip this step.",
      recipeIngredient: {
        metric: ["100g flour"],
        us: ["1 cup flour"],
      },
      recipeInstructions: {
        metric: ["Mix well"],
        us: ["Mix well"],
      },
      recipeYield: "4",
      cookTime: null,
      prepTime: null,
      totalTime: null,
      keywords: [],
      nutrition: { calories: 0, fat: 0, carbs: 0, protein: 0 },
    };

    const { normalizeRecipeFromJson } = await import("@/server/parser/normalize");

    vi.mocked(normalizeRecipeFromJson).mockResolvedValue({
      name: "Test Recipe",
      description: "Test",
      url: null,
      image: undefined,
      servings: undefined,
      prepMinutes: undefined,
      cookMinutes: undefined,
      totalMinutes: undefined,
      calories: null,
      fat: null,
      carbs: null,
      protein: null,
      recipeIngredients: [],
      steps: [],
      systemUsed: "metric",
      tags: [],
      images: [],
    } as any);

    const result = await normalizeExtractionOutput(output);

    expect(result?.notes).toBe("Let it rest for 10 minutes – don't skip this step.");
  });
});
