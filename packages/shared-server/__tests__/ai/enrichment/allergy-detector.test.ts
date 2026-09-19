/**
 * Allergy Detector Tests
 *
 * The AI Runtime is the single mocked AI seam — `decide` and
 * `generateStructured` — plus the loader's one question, whether this use of
 * the Decision Model is on, and the validation helper the language-model
 * path hands its claims to. Nothing else is wired.
 *
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AIConfigurationError, AIProviderError } from "@norish/shared-server/ai/runtime/errors";
import { isDecisionUseEnabled } from "@norish/shared-server/config/server-config-loader";

const mocked = vi.hoisted(() => ({
  decide: vi.fn(),
  generateStructured: vi.fn(),
  verifyClaims: vi.fn(),
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

vi.mock("@norish/shared-server/ai/enrichment/verification", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@norish/shared-server/ai/enrichment/verification")>()),
  verifyClaims: mocked.verifyClaims,
}));

vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  isDecisionUseEnabled: vi.fn(),
}));

vi.mock("@norish/shared-server/logger", () => ({ aiLogger: logger }));

const { detectAllergiesInRecipe, PRESENT_THRESHOLD, ABSENT_THRESHOLD } =
  await import("@norish/shared-server/ai/enrichment/allergy-detector");

const recipe = {
  title: "Pesto pasta",
  description: "Basil pesto over spaghetti.",
  ingredients: ["spaghetti", "basil", "pine nuts", "parmesan", "garlic", "olive oil"],
};

const HOUSEHOLD = ["Gluten", "Nuts", "Dairy", "Shellfish"];

/** A Decision answer with the given probability of presence per allergen. */
function decided(probabilities: Record<string, number>) {
  return {
    model: "jev-2026-09-01",
    answers: Object.fromEntries(
      Object.entries(probabilities).map(([allergen, probability]) => [
        allergen,
        { type: "boolean", probability },
      ])
    ),
  };
}

const CLEAR = { Gluten: 0.98, Nuts: 0.95, Dairy: 0.9, Shellfish: 0.01 };

describe("detectAllergiesInRecipe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isDecisionUseEnabled).mockResolvedValue(true);
    mocked.decide.mockResolvedValue(decided(CLEAR));
    mocked.generateStructured.mockResolvedValue({ detectedAllergens: ["Gluten", "Dairy"] });
    // Validation keeps everything unless a test says otherwise.
    mocked.verifyClaims.mockImplementation(({ claims }: { claims: { id: string }[] }) =>
      Promise.resolve({ kept: claims, dropped: [], mode: "off" })
    );
  });

  it("answers an empty allergen list without asking anything", async () => {
    await expect(detectAllergiesInRecipe(recipe, [])).resolves.toEqual([]);
    expect(mocked.decide).not.toHaveBeenCalled();
    expect(mocked.generateStructured).not.toHaveBeenCalled();
  });

  it("refuses a recipe with no ingredients before asking anything", async () => {
    await expect(
      detectAllergiesInRecipe({ ...recipe, ingredients: [] }, HOUSEHOLD)
    ).rejects.toThrow("No ingredients provided");
    expect(mocked.decide).not.toHaveBeenCalled();
    expect(mocked.generateStructured).not.toHaveBeenCalled();
  });

  describe("with a Decision Model configured", () => {
    it("asks one Boolean per household allergen on the structured recipe and no language model", async () => {
      const detected = await detectAllergiesInRecipe(recipe, HOUSEHOLD);

      expect(detected).toEqual(["gluten", "nuts", "dairy"]);
      expect(mocked.decide).toHaveBeenCalledTimes(1);
      expect(mocked.decide).toHaveBeenCalledWith({
        feature: "allergy-detection",
        state: {
          title: "Pesto pasta",
          description: "Basil pesto over spaghetti.",
          ingredients: recipe.ingredients,
        },
        questions: {
          Gluten: { type: "boolean", instructions: expect.stringMatching(/contain Gluten/) },
          Nuts: { type: "boolean", instructions: expect.stringMatching(/contain Nuts/) },
          Dairy: { type: "boolean", instructions: expect.stringMatching(/contain Dairy/) },
          Shellfish: { type: "boolean", instructions: expect.stringMatching(/contain Shellfish/) },
        },
      });
      expect(mocked.generateStructured).not.toHaveBeenCalled();
      expect(mocked.verifyClaims).not.toHaveBeenCalled();
      expect(vi.mocked(isDecisionUseEnabled)).toHaveBeenCalledWith("allergyDetection");
    });

    it("tags an allergen at exactly the present threshold and not one just below it", async () => {
      expect(PRESENT_THRESHOLD).toBe(0.7);

      // 0.69 is not present — and, being above the absent bound, is doubtful,
      // which sends the recipe on; so pair it with a clearly absent rest to
      // isolate the upper boundary first.
      mocked.decide.mockResolvedValue(
        decided({ Gluten: 0.7, Nuts: 0.01, Dairy: 0.02, Shellfish: 0.0 })
      );
      await expect(detectAllergiesInRecipe(recipe, HOUSEHOLD)).resolves.toEqual(["gluten"]);
      expect(mocked.generateStructured).not.toHaveBeenCalled();

      mocked.decide.mockResolvedValue(
        decided({ Gluten: 0.69, Nuts: 0.01, Dairy: 0.02, Shellfish: 0.0 })
      );
      await expect(detectAllergiesInRecipe(recipe, HOUSEHOLD)).resolves.toEqual([
        "gluten",
        "dairy",
      ]);
      expect(mocked.generateStructured).toHaveBeenCalledTimes(1);
    });

    it("treats an allergen at exactly the absent threshold as absent, and one just above it as doubtful", async () => {
      expect(ABSENT_THRESHOLD).toBe(0.15);

      mocked.decide.mockResolvedValue(decided({ ...CLEAR, Shellfish: 0.15 }));
      await expect(detectAllergiesInRecipe(recipe, HOUSEHOLD)).resolves.toEqual([
        "gluten",
        "nuts",
        "dairy",
      ]);
      expect(mocked.generateStructured).not.toHaveBeenCalled();

      mocked.decide.mockResolvedValue(decided({ ...CLEAR, Shellfish: 0.16 }));
      await expect(detectAllergiesInRecipe(recipe, HOUSEHOLD)).resolves.toEqual([
        "gluten",
        "dairy",
      ]);
      expect(mocked.generateStructured).toHaveBeenCalledTimes(1);
    });

    it("hands the whole recipe to the language model on one doubtful allergen, merging nothing", async () => {
      // Nuts is clearly present by the Decision, but the language model did
      // not name it: the language model's answer stands alone.
      mocked.decide.mockResolvedValue(decided({ ...CLEAR, Shellfish: 0.4 }));

      await expect(detectAllergiesInRecipe(recipe, HOUSEHOLD)).resolves.toEqual([
        "gluten",
        "dairy",
      ]);
      expect(mocked.decide).toHaveBeenCalledTimes(1);
      expect(mocked.generateStructured).toHaveBeenCalledTimes(1);
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ tagged: 3, doubtful: 1 }),
        expect.stringMatching(/unsure/i)
      );
    });

    it("says which path produced the tags, with the counts", async () => {
      await detectAllergiesInRecipe(recipe, HOUSEHOLD);

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ path: "decision", tagged: 3, doubtful: 0 }),
        "Allergy detection completed"
      );
    });

    it("sends a forty-allergen household as one request", async () => {
      const household = Array.from({ length: 40 }, (_, index) => `Allergen ${index + 1}`);

      mocked.decide.mockResolvedValue(
        decided(Object.fromEntries(household.map((allergen) => [allergen, 0.01])))
      );

      await expect(detectAllergiesInRecipe(recipe, household)).resolves.toEqual([]);
      expect(mocked.decide).toHaveBeenCalledTimes(1);
      expect(Object.keys(mocked.decide.mock.calls[0]?.[0].questions)).toHaveLength(40);
      expect(mocked.generateStructured).not.toHaveBeenCalled();
    });

    it.each([
      ["a non-retryable failure", new AIConfigurationError("no model")],
      ["a retryable failure", new AIProviderError("overloaded", { retryable: true })],
      ["an unexpected error", new Error("socket hang up")],
    ])("falls back to the language model on %s, logging at warn", async (_case, failure) => {
      mocked.decide.mockRejectedValue(failure);

      await expect(detectAllergiesInRecipe(recipe, HOUSEHOLD)).resolves.toEqual([
        "gluten",
        "dairy",
      ]);
      expect(mocked.generateStructured).toHaveBeenCalledTimes(1);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ err: failure, feature: "allergy-detection" }),
        expect.stringMatching(/falling back/i)
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ path: "language-model" }),
        "Allergy detection completed"
      );
    });
  });

  describe("without the Decision Model", () => {
    beforeEach(() => {
      vi.mocked(isDecisionUseEnabled).mockResolvedValue(false);
    });

    it("makes exactly today's request: one structured call with the household's list as a section", async () => {
      await detectAllergiesInRecipe(recipe, HOUSEHOLD);

      expect(mocked.decide).not.toHaveBeenCalled();
      expect(mocked.generateStructured).toHaveBeenCalledTimes(1);
      expect(mocked.generateStructured).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: "allergy-detection",
          sections: [
            [
              "RECIPE TITLE: Pesto pasta",
              "DESCRIPTION: Basil pesto over spaghetti.",
              "",
              "INGREDIENTS:",
              ...recipe.ingredients.map((ingredient) => `- ${ingredient}`),
            ].join("\n"),
            "ALLERGENS TO DETECT: Gluten, Nuts, Dairy, Shellfish",
          ],
        })
      );
    });

    it("keeps only allergens from the household's list, lowercased and deduplicated", async () => {
      mocked.generateStructured.mockResolvedValue({
        detectedAllergens: ["Gluten", "gluten ", "Peanuts", "DAIRY"],
      });

      await expect(detectAllergiesInRecipe(recipe, HOUSEHOLD)).resolves.toEqual([
        "gluten",
        "dairy",
      ]);
    });

    it("validates its own claims under the strict allergen constant and writes the survivors", async () => {
      mocked.verifyClaims.mockResolvedValue({
        kept: [{ id: "gluten", question: "q" }],
        dropped: [{ claim: { id: "dairy", question: "q" }, probability: 0.02 }],
        mode: "enforce",
      });

      await expect(detectAllergiesInRecipe(recipe, HOUSEHOLD)).resolves.toEqual(["gluten"]);
      expect(mocked.verifyClaims).toHaveBeenCalledWith({
        feature: "allergy-detection",
        state: {
          title: "Pesto pasta",
          description: "Basil pesto over spaghetti.",
          ingredients: recipe.ingredients,
        },
        claims: [
          { id: "gluten", question: expect.stringMatching(/contain gluten/) },
          { id: "dairy", question: expect.stringMatching(/contain dairy/) },
        ],
        dropThreshold: 0.05,
      });
    });

    it("validates nothing when the language model claimed nothing", async () => {
      mocked.generateStructured.mockResolvedValue({ detectedAllergens: [] });

      await expect(detectAllergiesInRecipe(recipe, HOUSEHOLD)).resolves.toEqual([]);
      expect(mocked.verifyClaims).not.toHaveBeenCalled();
    });

    it("propagates the runtime's failure", async () => {
      mocked.generateStructured.mockRejectedValue(new AIConfigurationError("no key"));

      await expect(detectAllergiesInRecipe(recipe, HOUSEHOLD)).rejects.toBeInstanceOf(
        AIConfigurationError
      );
    });
  });
});
