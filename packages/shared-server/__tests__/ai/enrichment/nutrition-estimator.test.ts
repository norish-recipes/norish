/**
 * Nutrition Estimator Tests
 *
 * The AI Runtime is the single mocked AI seam, plus the validation helper the
 * estimate is handed to before it is returned.
 *
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AIResponseError } from "@norish/shared-server/ai/runtime/errors";

const mocked = vi.hoisted(() => ({
  generateStructured: vi.fn(),
  verifyClaims: vi.fn(),
}));

vi.mock("@norish/shared-server/ai/runtime/runtime", () => ({
  generateStructured: mocked.generateStructured,
}));

vi.mock("@norish/shared-server/ai/enrichment/verification", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@norish/shared-server/ai/enrichment/verification")>()),
  verifyClaims: mocked.verifyClaims,
}));

vi.mock("@norish/shared-server/logger", () => ({
  aiLogger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { estimateNutritionFromIngredients } =
  await import("@norish/shared-server/ai/enrichment/nutrition-estimator");

const INGREDIENTS = [
  { ingredientName: "rolled oats", amount: 80, unit: "g" },
  { ingredientName: "milk", amount: 200, unit: "ml" },
  { ingredientName: "honey", amount: null, unit: null },
];

const ESTIMATE = { calories: 420, fat: 9, carbs: 68, protein: 15 };

beforeEach(() => {
  vi.clearAllMocks();
  mocked.generateStructured.mockResolvedValue(ESTIMATE);
  mocked.verifyClaims.mockImplementation(({ claims }: { claims: { id: string }[] }) =>
    Promise.resolve({ kept: claims, dropped: [], mode: "shadow" })
  );
});

describe("estimateNutritionFromIngredients", () => {
  it("refuses a recipe with no ingredients", async () => {
    await expect(estimateNutritionFromIngredients("Oats", 2, [])).rejects.toThrow(
      "No ingredients provided"
    );
    expect(mocked.generateStructured).not.toHaveBeenCalled();
  });

  it("runs under the nutrition-estimation prompt with the numbered ingredient list", async () => {
    await estimateNutritionFromIngredients("Overnight oats", 2, INGREDIENTS);

    expect(mocked.generateStructured).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "nutrition-estimation",
        fill: {
          recipeName: "Overnight oats",
          servings: "2",
          ingredients: "- 80 g rolled oats\n- 200 ml milk\n- honey",
        },
      })
    );
  });

  it("returns the estimate the model gave", async () => {
    await expect(
      estimateNutritionFromIngredients("Overnight oats", 2, INGREDIENTS)
    ).resolves.toEqual(ESTIMATE);
  });

  describe("Enrichment Validation", () => {
    it("asks one question per figure, in shadow, and changes nothing", async () => {
      const estimate = await estimateNutritionFromIngredients("Overnight oats", 2, INGREDIENTS);

      expect(mocked.verifyClaims).toHaveBeenCalledWith({
        feature: "nutrition-estimation",
        state: {
          recipeName: "Overnight oats",
          servings: 2,
          ingredients: ["- 80 g rolled oats", "- 200 ml milk", "- honey"],
        },
        claims: [
          { id: "calories", question: expect.stringMatching(/420 kcal per serving/) },
          { id: "fat", question: expect.stringMatching(/9 g of fat/) },
          { id: "carbs", question: expect.stringMatching(/68 g of carbohydrates/) },
          { id: "protein", question: expect.stringMatching(/15 g of protein/) },
        ],
        mode: "shadow",
      });
      expect(estimate).toEqual(ESTIMATE);
    });

    it("keeps the whole group when a figure is disputed in shadow", async () => {
      mocked.verifyClaims.mockResolvedValue({
        kept: [],
        dropped: [{ claim: { id: "calories" }, probability: 0.02 }],
        mode: "shadow",
      });

      await expect(
        estimateNutritionFromIngredients("Overnight oats", 2, INGREDIENTS)
      ).resolves.toEqual(ESTIMATE);
    });

    it("fails the run for a retry, writing nothing, once a disputed figure is enforced", async () => {
      mocked.verifyClaims.mockResolvedValue({
        kept: [],
        dropped: [{ claim: { id: "calories" }, probability: 0.02 }],
        mode: "enforce",
      });

      const error = await estimateNutritionFromIngredients("Overnight oats", 2, INGREDIENTS).catch(
        (err: unknown) => err
      );

      expect(error).toBeInstanceOf(AIResponseError);
      expect((error as AIResponseError).retryable).toBe(true);
      expect((error as AIResponseError).message).toMatch(/calories/);
    });
  });
});
