/**
 * Auto-Categorizer Tests
 *
 * The AI Runtime is the single mocked AI seam — `decide` and
 * `generateStructured` — plus the loader's two questions, whether a Decision
 * Model is configured and whether a use of it is on. Nothing else is wired:
 * Enrichment Validation runs for real, through the same `decide`.
 *
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AIConfigurationError, AIProviderError } from "@norish/shared-server/ai/runtime/errors";
import {
  isDecisionModelConfigured,
  isDecisionUseEnabled,
} from "@norish/shared-server/config/server-config-loader";

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
  isDecisionModelConfigured: vi.fn(),
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
    // No Decision Model for validation unless a test says otherwise: every
    // claim is kept unjudged.
    vi.mocked(isDecisionModelConfigured).mockResolvedValue(false);
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
      vi.mocked(isDecisionModelConfigured).mockResolvedValue(true);

      const categories = await categorizeRecipe(recipe);

      expect(categories).toEqual(["Breakfast"]);
      // A Decision's answer is not validated again: it already is a Decision,
      // so the one request is the only one even with validation available.
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

  describe("Enrichment Validation of the language-model path", () => {
    /** The validation Decision: one probability per claim id. */
    function verdicts(probabilities: Record<string, number>) {
      return {
        model: "jev",
        answers: Object.fromEntries(
          Object.entries(probabilities).map(([id, probability]) => [
            id,
            { type: "boolean", probability },
          ])
        ),
      };
    }

    beforeEach(() => {
      // The kind's own use is off, so the language model answers; the
      // Validate enrichments use is on, so its claims are judged for real.
      vi.mocked(isDecisionModelConfigured).mockResolvedValue(true);
      vi.mocked(isDecisionUseEnabled).mockImplementation((use) =>
        Promise.resolve(use === "validateEnrichments")
      );
    });

    it("checks the matched categories and writes the survivors", async () => {
      mocked.generateStructured.mockResolvedValue({ categories: ["Dinner", "brunch"] });
      mocked.decide.mockResolvedValue(verdicts({ Dinner: 0.9, Breakfast: 0.05 }));

      const categories = await categorizeRecipe(recipe);

      expect(mocked.decide).toHaveBeenCalledTimes(1);
      expect(mocked.decide).toHaveBeenCalledWith({
        feature: "auto-categorization:validation",
        state: {
          title: "Overnight oats",
          description: "Oats soaked in milk, eaten cold.",
          ingredients: ["rolled oats", "milk", "chia seeds", "honey"],
        },
        questions: {
          Dinner: { type: "boolean", instructions: expect.stringMatching(/dinner/i) },
          Breakfast: { type: "boolean", instructions: expect.stringMatching(/breakfast/i) },
        },
      });
      expect(categories).toEqual(["Dinner"]);
    });

    it("returns an empty list when every category was dropped, leaving the worker's rule to it", async () => {
      mocked.decide.mockResolvedValue(verdicts({ Dinner: 0.01 }));

      await expect(categorizeRecipe(recipe)).resolves.toEqual([]);
    });

    it("keeps a disputed category when the Validate enrichments use is off: the verdict is only logged", async () => {
      vi.mocked(isDecisionUseEnabled).mockResolvedValue(false);
      mocked.decide.mockResolvedValue(verdicts({ Dinner: 0.01 }));

      await expect(categorizeRecipe(recipe)).resolves.toEqual(["Dinner"]);
      expect(mocked.decide).toHaveBeenCalledTimes(1);
    });

    it("never validates stored data: a category already on the recipe is neither a question nor a casualty", async () => {
      // The kind only ever sees title, description and ingredients; a stored
      // category riding along on the input is not this run's claim.
      const stored = { ...recipe, categories: ["Snack"] };

      mocked.decide.mockResolvedValue(verdicts({ Dinner: 0.9, Snack: 0.01 }));

      await expect(categorizeRecipe(stored)).resolves.toEqual(["Dinner"]);
      expect(Object.keys(mocked.decide.mock.calls[0]?.[0].questions)).toEqual(["Dinner"]);
    });
  });
});
