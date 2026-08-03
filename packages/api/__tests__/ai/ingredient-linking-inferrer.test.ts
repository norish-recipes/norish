/**
 * Ingredient Linking inference.
 *
 * Only the external AI provider is mocked. What matters here is what reaches
 * the model — numbered lines and steps, headings withheld — and what survives
 * coming back: prompt numbers mapped onto row orders, invented numbers
 * dropped, and an empty claim returned as a valid answer rather than an
 * error.
 *
 * @vitest-environment node
 */
import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { inferStepIngredients } from "@norish/api/ai/ingredient-linking-inferrer";
import { fillPrompt, loadPrompt } from "@norish/shared-server/ai/prompts/loader";
import { isAIEnabled } from "@norish/shared-server/config/server-config-loader";

vi.mock("ai", () => ({
  generateText: vi.fn(),
  Output: { object: vi.fn(({ schema }) => schema) },
}));

vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  isAIEnabled: vi.fn(),
}));

vi.mock("@norish/shared-server/ai/providers", () => ({
  getModels: vi.fn().mockResolvedValue({ model: {}, providerName: "openai" }),
  getGenerationSettings: vi.fn().mockResolvedValue({ temperature: 0.7, maxTokens: 4096 }),
}));

vi.mock("@norish/shared-server/ai/prompts/loader", () => ({
  loadPrompt: vi.fn(),
  fillPrompt: vi.fn(
    (template: string, vars: Record<string, string>) =>
      `${template}\n${Object.entries(vars)
        .map(([key, value]) => `${key}=${value}`)
        .join("\n")}`
  ),
}));

vi.mock("@norish/shared-server/logger", () => ({
  aiLogger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const RECIPE = {
  title: "Spiced Stew",
  ingredients: [
    { order: 0, text: "# Spices", isHeading: true },
    { order: 1, text: "5 g salt", isHeading: false },
    { order: 2, text: "3 g pepper", isHeading: false },
    { order: 4, text: "50 ml water", isHeading: false },
  ],
  steps: [
    { order: 0, text: "# Cooking", isHeading: true },
    { order: 1, text: "Add the spices.", isHeading: false },
    { order: 3, text: "Add half the water.", isHeading: false },
  ],
};

function respondWith(output: unknown) {
  vi.mocked(generateText).mockResolvedValue({
    output,
    usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(isAIEnabled).mockResolvedValue(true);
  vi.mocked(loadPrompt).mockResolvedValue("Work out which lines each step uses.");
});

describe("inferStepIngredients", () => {
  it("is inert rather than broken when AI is globally disabled", async () => {
    vi.mocked(isAIEnabled).mockResolvedValue(false);

    const result = await inferStepIngredients(RECIPE);

    expect(result).toMatchObject({ success: false, code: "AI_DISABLED" });
    expect(generateText).not.toHaveBeenCalled();
  });

  it("refuses a recipe with nothing linkable", async () => {
    const result = await inferStepIngredients({
      title: "Bare",
      ingredients: [{ order: 0, text: "# Only a heading", isHeading: true }],
      steps: RECIPE.steps,
    });

    expect(result).toMatchObject({ success: false, code: "INVALID_INPUT" });
    expect(generateText).not.toHaveBeenCalled();
  });

  it("numbers only the linkable rows in the prompt, withholding headings", async () => {
    respondWith({ links: [] });

    await inferStepIngredients(RECIPE);

    expect(loadPrompt).toHaveBeenCalledWith("ingredient-linking");
    expect(fillPrompt).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        ingredients: "1. 5 g salt\n2. 3 g pepper\n3. 50 ml water",
        steps: "1. Add the spices.\n2. Add half the water.",
      })
    );
  });

  it("maps the claim's prompt numbers back onto row orders", async () => {
    respondWith({
      links: [
        {
          step: 1,
          ingredients: [
            { line: 1, share: 1 },
            { line: 2, share: 1 },
          ],
        },
        { step: 2, ingredients: [{ line: 3, share: 0.5 }] },
      ],
    });

    const result = await inferStepIngredients(RECIPE);

    expect(result.success && result.data.links).toEqual([
      {
        stepOrder: 1,
        refs: [
          { ingredientOrder: 1, share: 1, order: 0 },
          { ingredientOrder: 2, share: 1, order: 1 },
        ],
      },
      // Row orders are not contiguous: the water line is order 4, step order 3.
      { stepOrder: 3, refs: [{ ingredientOrder: 4, share: 0.5, order: 0 }] },
    ]);
  });

  it("drops invented step and line numbers rather than writing them wrong", async () => {
    respondWith({
      links: [
        { step: 9, ingredients: [{ line: 1, share: 1 }] },
        { step: 1, ingredients: [{ line: 42, share: 1 }] },
      ],
    });

    const result = await inferStepIngredients(RECIPE);

    expect(result.success && result.data.links).toEqual([]);
  });

  it("returns an empty claim as a valid answer, not a failure", async () => {
    respondWith({ links: [] });

    const result = await inferStepIngredients(RECIPE);

    expect(result.success).toBe(true);
    expect(result.success && result.data.links).toEqual([]);
  });

  it("reports a provider failure as an ordinary retryable AI failure", async () => {
    vi.mocked(generateText).mockRejectedValue(new Error("provider timed out"));

    const result = await inferStepIngredients(RECIPE);

    expect(result.success).toBe(false);
  });
});
