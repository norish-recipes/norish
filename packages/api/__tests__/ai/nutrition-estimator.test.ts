/**
 * Nutrition Estimator Tests
 *
 * Tests for AI-based nutrition estimation, including rejection of
 * physically impossible all-zero estimates.
 *
 * @vitest-environment node
 */
import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { estimateNutritionFromIngredients } from "@norish/api/ai/nutrition-estimator";
import { isAIEnabled } from "@norish/shared-server/config/server-config-loader";

// Mock dependencies - vi.mock is hoisted by Vitest
vi.mock("ai", () => ({
  generateText: vi.fn(),
  Output: {
    object: vi.fn(({ schema }) => schema),
  },
}));

vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  isAIEnabled: vi.fn(),
}));

vi.mock("@norish/shared-server/ai/providers", () => ({
  getModels: vi.fn().mockResolvedValue({
    model: {},
    providerName: "anthropic",
  }),
  getGenerationSettings: vi.fn().mockResolvedValue({
    temperature: 0.2,
    maxTokens: 3000,
  }),
}));

vi.mock("@norish/shared-server/ai/prompts/loader", () => ({
  loadPrompt: vi.fn().mockResolvedValue("Mock nutrition estimation prompt template"),
  fillPrompt: vi.fn((template, _vars) => template),
}));

vi.mock("@norish/shared-server/logger", () => ({
  aiLogger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

type GenerateTextResult = ReturnType<typeof generateText> extends Promise<infer R> ? R : never;

function mockAIOutput(output: unknown): void {
  vi.mocked(generateText).mockResolvedValue({
    output,
    usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 },
  } as GenerateTextResult);
}

describe("estimateNutritionFromIngredients", () => {
  const measuredIngredients = [
    { ingredientName: "Spaghettini", amount: 600, unit: "gram" },
    { ingredientName: "Olivenöl", amount: 80, unit: "milliliter" },
    { ingredientName: "Knoblauchzehe(n)", amount: 5, unit: null },
    { ingredientName: "Salz", amount: null, unit: null },
  ];

  const unmeasuredIngredients = [
    { ingredientName: "Salz", amount: null, unit: null },
    { ingredientName: "Parmesan", amount: null, unit: null },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isAIEnabled).mockResolvedValue(true);
  });

  it("returns error when AI is disabled", async () => {
    vi.mocked(isAIEnabled).mockResolvedValue(false);

    const result = await estimateNutritionFromIngredients("Pasta", 4, measuredIngredients);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("AI_DISABLED");
    }
  });

  it("returns error when no ingredients are provided", async () => {
    const result = await estimateNutritionFromIngredients("Pasta", 4, []);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("INVALID_INPUT");
    }
  });

  it("returns the estimate for a normal response", async () => {
    mockAIOutput({ calories: 700, fat: 20, carbs: 110, protein: 21 });

    const result = await estimateNutritionFromIngredients("Pasta", 4, measuredIngredients);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ calories: 700, fat: 20, carbs: 110, protein: 21 });
      expect(result.usage?.totalTokens).toBe(120);
    }
  });

  it("rejects an all-zero estimate when ingredients have parsed amounts", async () => {
    mockAIOutput({ calories: 0, fat: 0, carbs: 0, protein: 0 });

    const result = await estimateNutritionFromIngredients("Pasta", 4, measuredIngredients);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("INVALID_OUTPUT");
    }
  });

  it("accepts an all-zero estimate when no ingredient has a parsed amount", async () => {
    mockAIOutput({ calories: 0, fat: 0, carbs: 0, protein: 0 });

    const result = await estimateNutritionFromIngredients(
      "Gewürzmischung",
      4,
      unmeasuredIngredients
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ calories: 0, fat: 0, carbs: 0, protein: 0 });
    }
  });

  it("accepts a zero-calorie estimate when other values are non-zero", async () => {
    mockAIOutput({ calories: 0, fat: 0, carbs: 1, protein: 0 });

    const result = await estimateNutritionFromIngredients("Kräutertee", 4, measuredIngredients);

    expect(result.success).toBe(true);
  });

  it("returns error when AI returns empty output", async () => {
    mockAIOutput(null);

    const result = await estimateNutritionFromIngredients("Pasta", 4, measuredIngredients);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("EMPTY_RESPONSE");
    }
  });

  it("returns error when AI response is missing fields", async () => {
    mockAIOutput({ calories: 700, fat: 20 });

    const result = await estimateNutritionFromIngredients("Pasta", 4, measuredIngredients);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("VALIDATION_ERROR");
    }
  });
});
