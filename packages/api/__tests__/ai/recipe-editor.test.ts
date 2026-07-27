/**
 * Recipe Editor Tests
 *
 * Tests for AI-based recipe editing (applying a natural-language instruction
 * to an existing recipe).
 *
 * @vitest-environment node
 */
import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FullRecipeDTO } from "@norish/shared/contracts";
import type { FullRecipeInsertDTO } from "@norish/shared/contracts/dto/recipe";
import { editRecipeWithAI } from "@norish/api/ai/recipe-editor";
import {
  normalizeExtractionOutput,
  validateExtractionOutput,
} from "@norish/api/ai/features/recipe-extraction/normalizer";
import { buildRecipeEditPrompt } from "@norish/api/ai/prompts/builder";
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
  getModels: vi.fn().mockResolvedValue({ model: {}, providerName: "openai" }),
  getGenerationSettings: vi.fn().mockResolvedValue({ temperature: 0.7, maxOutputTokens: 4096 }),
}));

vi.mock("@norish/shared-server/logger", () => ({
  aiLogger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Mock the prompt builder and normalizer so we don't drag in DB/parser deps.
vi.mock("@norish/api/ai/prompts/builder", () => ({
  buildRecipeEditPrompt: vi.fn().mockResolvedValue("Mock recipe edit prompt"),
}));

vi.mock("@norish/api/ai/features/recipe-extraction/normalizer", () => ({
  validateExtractionOutput: vi.fn(),
  normalizeExtractionOutput: vi.fn(),
  getExtractionLogContext: vi.fn().mockReturnValue({}),
}));

function makeRecipe(overrides: Partial<FullRecipeDTO> = {}): FullRecipeDTO {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    userId: "user-1",
    name: "Spaghetti Carbonara",
    description: "Classic Italian pasta dish",
    notes: null,
    image: "recipes/img.jpg",
    url: "https://example.com/carbonara",
    servings: 4,
    prepMinutes: 10,
    cookMinutes: 15,
    totalMinutes: 25,
    systemUsed: "metric",
    calories: 600,
    fat: "20",
    carbs: "70",
    protein: "25",
    version: 3,
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-01T00:00:00Z"),
    recipeIngredients: [
      {
        ingredientName: "spaghetti",
        amount: 400,
        unit: "g",
        systemUsed: "metric",
        order: 0,
      },
      {
        ingredientName: "spaghetti",
        amount: 14,
        unit: "oz",
        systemUsed: "us",
        order: 0,
      },
    ],
    steps: [
      { step: "Boil pasta in 2 L water.", order: 0, systemUsed: "metric" },
      { step: "Boil pasta in 8 cups water.", order: 0, systemUsed: "us" },
    ],
    tags: [{ name: "italian" }],
    categories: ["Dinner"],
    author: undefined,
    images: [],
    videos: [],
    // Cast covers optional/derived fields not needed by the editor.
  } as unknown as FullRecipeDTO;
}

const RECIPE_ID = "11111111-1111-4111-8111-111111111111";

function makeNormalized(): FullRecipeInsertDTO {
  return {
    name: "Vegan Spaghetti Carbonara",
    description: "Classic Italian pasta dish, veganized",
    notes: null,
    servings: 4,
    recipeIngredients: [],
    steps: [],
    tags: [{ name: "italian" }, { name: "vegan" }],
    categories: ["Dinner"],
  } as unknown as FullRecipeInsertDTO;
}

describe("editRecipeWithAI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error when AI is disabled", async () => {
    vi.mocked(isAIEnabled).mockResolvedValue(false);

    const result = await editRecipeWithAI(makeRecipe(), "make it vegan", RECIPE_ID);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("AI features are disabled");
      expect(result.code).toBe("AI_DISABLED");
    }
    expect(generateText).not.toHaveBeenCalled();
  });

  it("returns error when the instruction is empty/whitespace", async () => {
    vi.mocked(isAIEnabled).mockResolvedValue(true);

    const result = await editRecipeWithAI(makeRecipe(), "   ", RECIPE_ID);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("INVALID_INPUT");
    }
    expect(generateText).not.toHaveBeenCalled();
  });

  it("serializes the current recipe (metric + US) into the edit prompt", async () => {
    vi.mocked(isAIEnabled).mockResolvedValue(true);
    vi.mocked(generateText).mockResolvedValue({
      output: { name: "x" },
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    } as ReturnType<typeof generateText> extends Promise<infer R> ? R : never);
    vi.mocked(validateExtractionOutput).mockReturnValue({ valid: true });
    vi.mocked(normalizeExtractionOutput).mockResolvedValue(makeNormalized());

    await editRecipeWithAI(makeRecipe(), "make it vegan", RECIPE_ID);

    expect(buildRecipeEditPrompt).toHaveBeenCalledTimes(1);
    const [currentRecipeJson, instruction] = vi.mocked(buildRecipeEditPrompt).mock.calls[0]!;
    expect(instruction).toBe("make it vegan");

    const parsed = JSON.parse(currentRecipeJson);
    expect(parsed.name).toBe("Spaghetti Carbonara");
    expect(parsed.recipeIngredient.metric).toContain("400 g spaghetti");
    expect(parsed.recipeIngredient.us).toContain("14 oz spaghetti");
    expect(parsed.recipeInstructions.metric).toContain("Boil pasta in 2 L water.");
    expect(parsed.recipeInstructions.us).toContain("Boil pasta in 8 cups water.");
    expect(parsed.keywords).toContain("italian");
  });

  it("returns validation error when the AI output is invalid", async () => {
    vi.mocked(isAIEnabled).mockResolvedValue(true);
    vi.mocked(generateText).mockResolvedValue({
      output: {},
      usage: { inputTokens: 100, outputTokens: 0, totalTokens: 100 },
    } as ReturnType<typeof generateText> extends Promise<infer R> ? R : never);
    vi.mocked(validateExtractionOutput).mockReturnValue({
      valid: false,
      error: "Recipe extraction failed - missing required fields",
    });

    const result = await editRecipeWithAI(makeRecipe(), "make it vegan", RECIPE_ID);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("VALIDATION_ERROR");
    }
    expect(normalizeExtractionOutput).not.toHaveBeenCalled();
  });

  it("returns error when normalization fails", async () => {
    vi.mocked(isAIEnabled).mockResolvedValue(true);
    vi.mocked(generateText).mockResolvedValue({
      output: { name: "x" },
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    } as ReturnType<typeof generateText> extends Promise<infer R> ? R : never);
    vi.mocked(validateExtractionOutput).mockReturnValue({ valid: true });
    vi.mocked(normalizeExtractionOutput).mockResolvedValue(null);

    const result = await editRecipeWithAI(makeRecipe(), "make it vegan", RECIPE_ID);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBe("VALIDATION_ERROR");
    }
  });

  it("successfully returns the normalized edited recipe with usage", async () => {
    vi.mocked(isAIEnabled).mockResolvedValue(true);
    vi.mocked(generateText).mockResolvedValue({
      output: { name: "x" },
      usage: { inputTokens: 200, outputTokens: 80, totalTokens: 280 },
    } as ReturnType<typeof generateText> extends Promise<infer R> ? R : never);
    vi.mocked(validateExtractionOutput).mockReturnValue({ valid: true });
    const normalized = makeNormalized();
    vi.mocked(normalizeExtractionOutput).mockResolvedValue(normalized);

    const result = await editRecipeWithAI(makeRecipe(), "make it vegan", RECIPE_ID);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(normalized);
      expect(result.usage?.totalTokens).toBe(280);
    }
    // Existing image is preserved via the normalize options.
    expect(normalizeExtractionOutput).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ recipeId: RECIPE_ID, image: "recipes/img.jpg" })
    );
  });

  it("handles thrown AI errors gracefully", async () => {
    vi.mocked(isAIEnabled).mockResolvedValue(true);
    vi.mocked(generateText).mockRejectedValue(new Error("API rate limit exceeded"));

    const result = await editRecipeWithAI(makeRecipe(), "make it vegan", RECIPE_ID);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.code).toBeDefined();
    }
  });
});
