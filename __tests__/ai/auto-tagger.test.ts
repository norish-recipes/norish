/**
 * Auto-Tagger Tests
 *
 * Tests for AI-based recipe auto-tagging functionality.
 */
import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { isAIEnabled, getAutoTaggingMode } from "@/config/server-config-loader";
import { generateTagsForRecipe } from "@/server/ai/auto-tagger";
import { listAllTagNames } from "@/server/db/repositories/tags";

// Mock dependencies - vi.mock is hoisted by Vitest
vi.mock("ai", () => ({
  generateText: vi.fn(),
  Output: {
    object: vi.fn(({ schema }) => schema),
  },
}));

vi.mock("@/config/server-config-loader", () => ({
  isAIEnabled: vi.fn(),
  getAutoTaggingMode: vi.fn(),
}));

vi.mock("@/server/db/repositories/tags", () => ({
  listAllTagNames: vi.fn(),
}));

vi.mock("@/server/ai/providers", () => ({
  getModels: vi.fn().mockResolvedValue({
    model: {},
    providerName: "openai",
  }),
  getGenerationSettings: vi.fn().mockResolvedValue({
    temperature: 0.7,
    maxTokens: 4096,
  }),
}));

vi.mock("@/server/ai/prompts/loader", () => ({
  loadPrompt: vi.fn().mockResolvedValue("Mock auto-tagging prompt template"),
  fillPrompt: vi.fn((template, _vars) => template),
}));

vi.mock("@/server/logger", () => ({
  aiLogger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("Auto-Tagger", () => {
  const mockRecipe = {
    title: "Spaghetti Carbonara",
    description: "Classic Italian pasta dish",
    ingredients: ["spaghetti", "eggs", "pancetta", "parmesan", "black pepper"],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateTagsForRecipe", () => {
    it("returns error when AI is disabled", async () => {
      vi.mocked(isAIEnabled).mockResolvedValue(false);

      const result = await generateTagsForRecipe(mockRecipe);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("AI features are disabled");
        expect(result.code).toBe("AI_DISABLED");
      }
    });

    it("returns error when auto-tagging mode is disabled", async () => {
      vi.mocked(isAIEnabled).mockResolvedValue(true);
      vi.mocked(getAutoTaggingMode).mockResolvedValue("disabled");

      const result = await generateTagsForRecipe(mockRecipe);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("Auto-tagging is disabled");
        expect(result.code).toBe("AI_DISABLED");
      }
    });

    it("returns error when recipe has no ingredients", async () => {
      vi.mocked(isAIEnabled).mockResolvedValue(true);
      vi.mocked(getAutoTaggingMode).mockResolvedValue("predefined");

      const recipeWithoutIngredients = {
        title: "Empty Recipe",
        ingredients: [],
      };

      const result = await generateTagsForRecipe(recipeWithoutIngredients);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("No ingredients provided");
        expect(result.code).toBe("INVALID_INPUT");
      }
    });

    it("successfully generates tags in predefined mode", async () => {
      vi.mocked(isAIEnabled).mockResolvedValue(true);
      vi.mocked(getAutoTaggingMode).mockResolvedValue("predefined");
      vi.mocked(generateText).mockResolvedValue({
        output: { tags: ["Italian", "Pasta", "Quick"] },
        usage: { inputTokens: 100, outputTokens: 20, totalTokens: 120 },
      } as ReturnType<typeof generateText> extends Promise<infer R> ? R : never);

      const result = await generateTagsForRecipe(mockRecipe);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(["italian", "pasta", "quick"]);
        expect(result.usage?.totalTokens).toBe(120);
      }
    });

    it("fetches existing tags in predefined_db mode", async () => {
      vi.mocked(isAIEnabled).mockResolvedValue(true);
      vi.mocked(getAutoTaggingMode).mockResolvedValue("predefined_db");
      vi.mocked(listAllTagNames).mockResolvedValue(["dinner", "italian", "vegetarian"]);
      vi.mocked(generateText).mockResolvedValue({
        output: { tags: ["Italian", "Dinner"] },
        usage: { inputTokens: 150, outputTokens: 15, totalTokens: 165 },
      } as ReturnType<typeof generateText> extends Promise<infer R> ? R : never);

      const result = await generateTagsForRecipe(mockRecipe);

      expect(result.success).toBe(true);
      expect(listAllTagNames).toHaveBeenCalled();
      if (result.success) {
        expect(result.data).toEqual(["italian", "dinner"]);
      }
    });

    it("normalizes tags (lowercase, trim, deduplicate)", async () => {
      vi.mocked(isAIEnabled).mockResolvedValue(true);
      vi.mocked(getAutoTaggingMode).mockResolvedValue("freeform");
      vi.mocked(generateText).mockResolvedValue({
        output: { tags: ["  PASTA  ", "Italian", "pasta", "Quick ", ""] },
        usage: { inputTokens: 100, outputTokens: 30, totalTokens: 130 },
      } as ReturnType<typeof generateText> extends Promise<infer R> ? R : never);

      const result = await generateTagsForRecipe(mockRecipe);

      expect(result.success).toBe(true);
      if (result.success) {
        // Should be lowercase, trimmed, deduplicated, empty strings removed
        expect(result.data).toEqual(["pasta", "italian", "quick"]);
      }
    });

    it("returns error when AI returns empty output", async () => {
      vi.mocked(isAIEnabled).mockResolvedValue(true);
      vi.mocked(getAutoTaggingMode).mockResolvedValue("predefined");
      vi.mocked(generateText).mockResolvedValue({
        output: null,
        usage: { inputTokens: 100, outputTokens: 0, totalTokens: 100 },
      } as ReturnType<typeof generateText> extends Promise<infer R> ? R : never);

      const result = await generateTagsForRecipe(mockRecipe);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("AI returned empty response");
        expect(result.code).toBe("EMPTY_RESPONSE");
      }
    });

    it("returns error when AI response is invalid (missing tags array)", async () => {
      vi.mocked(isAIEnabled).mockResolvedValue(true);
      vi.mocked(getAutoTaggingMode).mockResolvedValue("predefined");
      vi.mocked(generateText).mockResolvedValue({
        output: { notTags: ["something"] },
        usage: { inputTokens: 100, outputTokens: 10, totalTokens: 110 },
      } as ReturnType<typeof generateText> extends Promise<infer R> ? R : never);

      const result = await generateTagsForRecipe(mockRecipe);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("AI response missing tags array");
        expect(result.code).toBe("VALIDATION_ERROR");
      }
    });

    it("handles AI errors gracefully", async () => {
      vi.mocked(isAIEnabled).mockResolvedValue(true);
      vi.mocked(getAutoTaggingMode).mockResolvedValue("predefined");
      vi.mocked(generateText).mockRejectedValue(new Error("API rate limit exceeded"));

      const result = await generateTagsForRecipe(mockRecipe);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBeDefined();
      }
    });
  });
});
