/**
 * Recipe Provenance inference tests.
 *
 * @vitest-environment node
 */
import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { inferRecipeProvenance } from "@norish/api/ai/provenance-inferrer";
import { isAIEnabled } from "@norish/shared-server/config/server-config-loader";

const { MockAPICallError } = vi.hoisted(() => {
  class MockAPICallError extends Error {
    isRetryable: boolean;
    statusCode: number;

    constructor(statusCode: number, isRetryable: boolean) {
      super(`api error ${statusCode}`);
      this.name = "AI_APICallError";
      this.statusCode = statusCode;
      this.isRetryable = isRetryable;
    }

    static isInstance(error: unknown): error is MockAPICallError {
      return error instanceof MockAPICallError;
    }
  }

  return { MockAPICallError };
});

vi.mock("ai", () => ({
  generateText: vi.fn(),
  Output: { object: vi.fn(({ schema }: { schema: unknown }) => schema) },
  APICallError: MockAPICallError,
}));

vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  isAIEnabled: vi.fn(),
}));

vi.mock("@norish/shared-server/ai/providers", () => ({
  getModels: vi.fn().mockResolvedValue({ model: {}, providerName: "generic-openai" }),
  getGenerationSettings: vi.fn().mockResolvedValue({ temperature: 0, maxOutputTokens: 2048 }),
}));

vi.mock("@norish/shared-server/logger", () => ({
  aiLogger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const RECIPE = {
  title: "Lasagne",
  description: "Baked pasta",
  ingredients: ["pasta", "tomato", "beef"],
};

describe("inferRecipeProvenance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isAIEnabled).mockResolvedValue(true);
  });

  it("returns an AI_DISABLED error when AI is disabled", async () => {
    vi.mocked(isAIEnabled).mockResolvedValue(false);

    const result = await inferRecipeProvenance(RECIPE);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe("AI_DISABLED");
    expect(generateText).not.toHaveBeenCalled();
  });

  it("normalizes a well-formed inference result", async () => {
    vi.mocked(generateText).mockResolvedValue({
      output: {
        originCountryCode: "it",
        region: "  Emilia-Romagna  ",
        cuisines: ["Italian", "italian", " "],
        note: "  A classic baked pasta dish.  ",
      },
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    } as never);

    const result = await inferRecipeProvenance(RECIPE);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        originCountryCode: "IT",
        region: "Emilia-Romagna",
        cuisines: ["Italian"],
        note: "A classic baked pasta dish.",
      });
    }
  });

  it("coerces an unknown origin code to null", async () => {
    vi.mocked(generateText).mockResolvedValue({
      output: { originCountryCode: "XX", region: null, cuisines: ["Fusion"], note: "Uncertain." },
      usage: {},
    } as never);

    const result = await inferRecipeProvenance(RECIPE);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.originCountryCode).toBeNull();
      expect(result.data.cuisines).toEqual(["Fusion"]);
    }
  });

  it("returns EMPTY_RESPONSE when the model returns no output", async () => {
    vi.mocked(generateText).mockResolvedValue({ output: undefined } as never);

    const result = await inferRecipeProvenance(RECIPE);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe("EMPTY_RESPONSE");
  });

  it("classifies a non-retryable provider error as permanent (INVALID_INPUT)", async () => {
    vi.mocked(generateText).mockRejectedValue(new MockAPICallError(400, false));

    const result = await inferRecipeProvenance(RECIPE);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe("INVALID_INPUT");
  });

  it("classifies a retryable provider error as transient (PROVIDER_ERROR)", async () => {
    vi.mocked(generateText).mockRejectedValue(new MockAPICallError(503, true));

    const result = await inferRecipeProvenance(RECIPE);

    expect(result.success).toBe(false);
    if (!result.success) expect(result.code).toBe("PROVIDER_ERROR");
  });
});
