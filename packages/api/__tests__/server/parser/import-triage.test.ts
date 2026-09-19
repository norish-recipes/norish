// @vitest-environment node
/**
 * Import triage: the three cheap questions the import pipelines ask before
 * the expensive step (ADR-0035). The AI Runtime's `decide` is the one mocked
 * AI seam, plus the loader's one question — is a Decision Model configured.
 * Every answer is an opinion or none: nothing here ever throws.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AIConfigurationError, AIProviderError } from "@norish/shared-server/ai/runtime/errors";
import { isDecisionModelConfigured } from "@norish/shared-server/config/server-config-loader";

const mocked = vi.hoisted(() => ({ decide: vi.fn() }));
const logger = vi.hoisted(() => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }));

vi.mock("@norish/shared-server/ai/runtime/runtime", () => ({ decide: mocked.decide }));
vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  isDecisionModelConfigured: vi.fn(),
}));
vi.mock("@norish/shared-server/logger", () => ({
  parserLogger: logger,
  aiLogger: logger,
  serverLogger: logger,
  createLogger: () => logger,
}));

const {
  isRecipe,
  isParseComplete,
  NOT_A_RECIPE_THRESHOLD,
  INCOMPLETE_PARSE_MAX_SCORE,
  PARSE_COMPLETENESS_LEVELS,
} = await import("@norish/api/parser/import-triage");

function recipeAnswer(probability: number) {
  return { model: "jev", answers: { isRecipe: { type: "boolean", probability } } };
}

function scoreAnswer(score: number) {
  return {
    model: "jev",
    answers: { completeness: { type: "score", score, probabilities: { 0: 0.1, 1: 0.3, 2: 0.6 } } },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isDecisionModelConfigured).mockResolvedValue(true);
});

describe("isRecipe", () => {
  it("asks one Boolean on the text, capped at what the extractor reads", async () => {
    mocked.decide.mockResolvedValue(recipeAnswer(0.9));
    const page = "x".repeat(60_000);

    await expect(isRecipe(page)).resolves.toBe(true);
    expect(mocked.decide).toHaveBeenCalledTimes(1);
    const asked = mocked.decide.mock.calls[0]?.[0];

    expect(asked.feature).toBe("import-triage");
    expect(asked.state).toHaveLength(50_000);
    expect(asked.questions).toEqual({
      isRecipe: { type: "boolean", instructions: expect.stringMatching(/cooking recipe/i) },
    });
  });

  it("refuses at exactly the threshold and proceeds just above it", async () => {
    expect(NOT_A_RECIPE_THRESHOLD).toBe(0.15);

    mocked.decide.mockResolvedValue(recipeAnswer(0.15));
    await expect(isRecipe("Our terms of service")).resolves.toBe(false);

    mocked.decide.mockResolvedValue(recipeAnswer(0.16));
    await expect(isRecipe("Our terms of service")).resolves.toBe(true);
  });

  it("has no opinion on empty text, without asking", async () => {
    await expect(isRecipe("   ")).resolves.toBeNull();
    expect(mocked.decide).not.toHaveBeenCalled();
    expect(isDecisionModelConfigured).not.toHaveBeenCalled();
  });

  it("has no opinion without a Decision Model, without asking", async () => {
    vi.mocked(isDecisionModelConfigured).mockResolvedValue(false);

    await expect(isRecipe("Ingredients: 2 eggs")).resolves.toBeNull();
    expect(mocked.decide).not.toHaveBeenCalled();
  });

  it.each([
    ["a non-retryable failure", new AIConfigurationError("no model")],
    ["a retryable failure", new AIProviderError("overloaded", { retryable: true })],
    ["an unexpected error", new Error("socket hang up")],
  ])("has no opinion on %s, logging at warn", async (_case, failure) => {
    mocked.decide.mockRejectedValue(failure);

    await expect(isRecipe("Ingredients: 2 eggs")).resolves.toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ err: failure, feature: "import-triage" }),
      expect.stringMatching(/no opinion/i)
    );
  });
});

describe("isParseComplete", () => {
  const parsed = { name: "Pesto", recipeIngredients: [{ ingredientName: "basil" }], steps: [] };

  it("asks one three-level Score on the parsed recipe", async () => {
    mocked.decide.mockResolvedValue(scoreAnswer(1.8));

    await expect(isParseComplete(parsed)).resolves.toBe(true);
    expect(mocked.decide).toHaveBeenCalledWith({
      feature: "import-triage",
      state: parsed,
      questions: {
        completeness: {
          type: "score",
          instructions: expect.stringMatching(/complete/i),
          criteria: PARSE_COMPLETENESS_LEVELS,
        },
      },
    });
    expect(PARSE_COMPLETENESS_LEVELS).toHaveLength(3);
  });

  it("drops the undefined members a parser output carries before sending it", async () => {
    mocked.decide.mockResolvedValue(scoreAnswer(1.8));

    await isParseComplete({ name: "Pesto", description: undefined });

    expect(mocked.decide.mock.calls[0]?.[0].state).toEqual({ name: "Pesto" });
  });

  it("calls a parse incomplete at exactly the constant and complete just above it", async () => {
    expect(INCOMPLETE_PARSE_MAX_SCORE).toBe(0.9);

    mocked.decide.mockResolvedValue(scoreAnswer(0.9));
    await expect(isParseComplete(parsed)).resolves.toBe(false);

    mocked.decide.mockResolvedValue(scoreAnswer(0.91));
    await expect(isParseComplete(parsed)).resolves.toBe(true);
  });

  it("has no opinion without a Decision Model or on a failure", async () => {
    vi.mocked(isDecisionModelConfigured).mockResolvedValue(false);
    await expect(isParseComplete(parsed)).resolves.toBeNull();

    vi.mocked(isDecisionModelConfigured).mockResolvedValue(true);
    mocked.decide.mockRejectedValue(new AIProviderError("down", { retryable: true }));
    await expect(isParseComplete(parsed)).resolves.toBeNull();
  });
});
