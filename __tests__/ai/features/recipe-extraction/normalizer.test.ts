/**
 * @vitest-environment node
 */
import type { RecipeExtractionOutput } from "@/server/ai/schemas/recipe.schema";
import type { FullRecipeInsertDTO } from "@/types/dto/recipe";

import { describe, it, expect, vi } from "vitest";

import {
  validateExtractionOutput,
  getExtractionLogContext,
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
      nutrition: { calories: 0, fat: 0, carbs: 0, protein: 0 },
    } as unknown as RecipeExtractionOutput;

    const context = getExtractionLogContext(output, null);

    expect(context).toEqual({
      recipeName: "Test Recipe",
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
