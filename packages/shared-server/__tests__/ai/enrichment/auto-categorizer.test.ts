/**
 * Auto-Categorizer Tests
 *
 * The AI Runtime is the single mocked AI seam — `decide` and
 * `generateStructured` — plus the loader's one question, whether this use of
 * the Decision Model is on. Nothing else is wired.
 *
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AIConfigurationError, AIProviderError } from "@norish/shared-server/ai/runtime/errors";
import { isDecisionUseEnabled } from "@norish/shared-server/config/server-config-loader";

const mocked = vi.hoisted(() => ({
  decide: vi.fn(),
  generateStructured: vi.fn(),
}));

const logger = vi.hoisted(() => ({
  info: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@norish/shared-server/ai/runtime/runtime", () => ({
  decide: mocked.decide,
  generateStructured: mocked.generateStructured,
}));

vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  isDecisionUseEnabled: vi.fn(),
}));

vi.mock("@norish/shared-server/logger", () => ({ aiLogger: logger }));

const { categorizeRecipe, CATEGORY_THRESHOLD } =
  await import("@norish/shared-server/ai/enrichment/auto-categorizer");

const recipe = {
  title: "Overnight oats",
  description: "Oats soaked in milk, eaten cold.",
  ingredients: ["rolled oats", "milk", "chia seeds", "honey"],
};

/** A Decision answer with the given probability per category. */
function decided(
  probabilities: Partial<Record<"Breakfast" | "Lunch" | "Dinner" | "Snack", number>>
) {
  return {
    model: "jev-2026-09-01",
    answers: Object.fromEntries(
      (["Breakfast", "Lunch", "Dinner", "Snack"] as const).map((category) => [
        category,
        { type: "boolean", probability: probabilities[category] ?? 0.01 },
      ])
    ),
  };
}

describe("categorizeRecipe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isDecisionUseEnabled).mockResolvedValue(true);
    mocked.decide.mockResolvedValue(decided({ Breakfast: 0.95 }));
    mocked.generateStructured.mockResolvedValue({ categories: ["Dinner"] });
  });

  it("refuses a recipe with no ingredients before asking anything", async () => {
    await expect(categorizeRecipe({ ...recipe, ingredients: [] })).rejects.toThrow(
      "No ingredients provided"
    );
    expect(mocked.decide).not.toHaveBeenCalled();
    expect(mocked.generateStructured).not.toHaveBeenCalled();
  });

  describe("with a Decision Model configured", () => {
    it("asks four Boolean questions on the structured recipe and no language model", async () => {
      const categories = await categorizeRecipe(recipe);

      expect(categories).toEqual(["Breakfast"]);
      expect(mocked.decide).toHaveBeenCalledTimes(1);
      expect(mocked.decide).toHaveBeenCalledWith({
        feature: "auto-categorization",
        state: {
          title: "Overnight oats",
          description: "Oats soaked in milk, eaten cold.",
          ingredients: ["rolled oats", "milk", "chia seeds", "honey"],
        },
        questions: {
          Breakfast: { type: "boolean", instructions: expect.stringMatching(/breakfast/i) },
          Lunch: { type: "boolean", instructions: expect.stringMatching(/lunch/i) },
          Dinner: { type: "boolean", instructions: expect.stringMatching(/dinner/i) },
          Snack: { type: "boolean", instructions: expect.stringMatching(/snack/i) },
        },
      });
      expect(mocked.generateStructured).not.toHaveBeenCalled();
      expect(vi.mocked(isDecisionUseEnabled)).toHaveBeenCalledWith("autoCategorization");
    });

    it("sets every category that clears the threshold, since a recipe may be several", async () => {
      mocked.decide.mockResolvedValue(decided({ Breakfast: 0.8, Snack: 0.7, Lunch: 0.3 }));

      await expect(categorizeRecipe(recipe)).resolves.toEqual(["Breakfast", "Snack"]);
    });

    it("sets a category at exactly the threshold and not one just below it", async () => {
      expect(CATEGORY_THRESHOLD).toBe(0.6);

      mocked.decide.mockResolvedValue(decided({ Breakfast: 0.6, Snack: 0.59 }));

      await expect(categorizeRecipe(recipe)).resolves.toEqual(["Breakfast"]);
      expect(mocked.generateStructured).not.toHaveBeenCalled();
    });

    it("asks the language model when nothing clears the threshold, and uses its answer", async () => {
      mocked.decide.mockResolvedValue(decided({ Breakfast: 0.59, Dinner: 0.4 }));

      await expect(categorizeRecipe(recipe)).resolves.toEqual(["Dinner"]);
      expect(mocked.decide).toHaveBeenCalledTimes(1);
      expect(mocked.generateStructured).toHaveBeenCalledTimes(1);
    });

    it("says which path produced the categories", async () => {
      await categorizeRecipe(recipe);

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ path: "decision", categories: ["Breakfast"] }),
        "Auto-categorization completed"
      );
    });

    it.each([
      ["a non-retryable failure", new AIConfigurationError("no model")],
      ["a retryable failure", new AIProviderError("overloaded", { retryable: true })],
      ["an unexpected error", new Error("socket hang up")],
    ])("falls back to the language model on %s, logging at warn", async (_case, failure) => {
      mocked.decide.mockRejectedValue(failure);

      await expect(categorizeRecipe(recipe)).resolves.toEqual(["Dinner"]);
      expect(mocked.generateStructured).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ err: failure, feature: "auto-categorization" }),
        expect.stringMatching(/falling back/i)
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ path: "language-model" }),
        "Auto-categorization completed"
      );
    });
  });

  describe("without the Decision Model", () => {
    beforeEach(() => {
      vi.mocked(isDecisionUseEnabled).mockResolvedValue(false);
    });

    it("makes exactly today's request: one structured call under the auto-categorization prompt", async () => {
      await categorizeRecipe(recipe);

      expect(mocked.decide).not.toHaveBeenCalled();
      expect(mocked.generateStructured).toHaveBeenCalledTimes(1);
      expect(mocked.generateStructured).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: "auto-categorization",
          sections: [
            [
              "Title: Overnight oats",
              "Description: Oats soaked in milk, eaten cold.",
              "Ingredients:",
              "- rolled oats",
              "- milk",
              "- chia seeds",
              "- honey",
            ].join("\n"),
          ],
        })
      );
    });

    it("matches the model's words onto the four categories, dropping the rest", async () => {
      mocked.generateStructured.mockResolvedValue({
        categories: ["brunch", "Dinner", "supper", "random gibberish"],
      });

      await expect(categorizeRecipe(recipe)).resolves.toEqual(["Breakfast", "Dinner"]);
    });

    it("returns an empty list when nothing matches, leaving the worker's rule to it", async () => {
      mocked.generateStructured.mockResolvedValue({ categories: [] });

      await expect(categorizeRecipe(recipe)).resolves.toEqual([]);
    });

    it("propagates the runtime's failure", async () => {
      mocked.generateStructured.mockRejectedValue(new AIConfigurationError("no key"));

      await expect(categorizeRecipe(recipe)).rejects.toBeInstanceOf(AIConfigurationError);
    });
  });
});
