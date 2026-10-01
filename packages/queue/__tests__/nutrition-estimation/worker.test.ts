// @vitest-environment node
/**
 * The nutrition estimation worker (ADR-0039): a recipe that supplies its own
 * Nutrition Information is estimated as a whole, as before; one that does
 * not asks the language model only about the lines its worked-out total
 * leaves out, gives it the counted lines as facts, and stores the share
 * apart; one whose every line counts asks nothing.
 */

import type { Job } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RecipeEnrichmentJobData } from "@norish/queue/contracts/job-types";
import type { WorkedOutNutrition } from "@norish/shared/lib/recipe-nutrition";

const mocks = vi.hoisted(() => ({
  getRecipeFull: vi.fn(),
  publishLifecycle: vi.fn(),
  publishRecipeUpdated: vi.fn(),
  reportStep: vi.fn(),
  replaceRecipeNutrition: vi.fn(),
  saveRecipeNutritionEstimate: vi.fn(),
  clearRecipeNutritionEstimate: vi.fn(),
  estimate: vi.fn(),
  workOut: vi.fn(),
}));

vi.mock("@norish/db", () => ({ getRecipeFull: mocks.getRecipeFull }));

vi.mock("@norish/db/repositories/recipe-enrichment", () => ({
  replaceRecipeNutrition: mocks.replaceRecipeNutrition,
  saveRecipeNutritionEstimate: mocks.saveRecipeNutritionEstimate,
  clearRecipeNutritionEstimate: mocks.clearRecipeNutritionEstimate,
}));

vi.mock("@norish/shared-server/ai/enrichment/nutrition-estimator", () => ({
  estimateNutritionFromIngredients: mocks.estimate,
}));

vi.mock("@norish/shared-server/ingredients/nutrition/ingredient-nutrition", () => ({
  NO_HOUSEHOLD: { householdUserIds: [] },
}));

vi.mock("@norish/shared-server/ingredients/nutrition/recipe-nutrition", () => ({
  workOutRecipeNutrition: mocks.workOut,
}));

vi.mock("@norish/shared-server/logger", () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

vi.mock("../../src/enrichment/announce", () => ({
  publishEnrichmentLifecycle: mocks.publishLifecycle,
  publishEnrichmentRecipeUpdated: mocks.publishRecipeUpdated,
}));

vi.mock("../../src/job-steps", () => ({ reportStep: mocks.reportStep }));

const { processNutritionEstimationJob } = await import("../../src/nutrition-estimation/worker");

const ESTIMATE = { calories: 120, fat: 13, carbs: 0, protein: 0 };

const RECIPE = {
  id: "recipe-1",
  name: "Fried rice",
  servings: 2,
  systemUsed: "metric",
  calories: null,
  fat: null,
  carbs: null,
  protein: null,
  recipeIngredients: [
    {
      id: "rice",
      ingredientName: "rice",
      ingredientId: "i-rice",
      amount: 200,
      unit: "gram",
      systemUsed: "metric",
    },
    {
      id: "oil",
      ingredientName: "oil for frying",
      ingredientId: "i-oil",
      amount: null,
      unit: null,
      systemUsed: "metric",
    },
  ],
};

const WORKED: WorkedOutNutrition = {
  perServing: { calories: 350, fat: 1, carbs: 78, protein: 7 },
  uncounted: [{ lineId: "oil", name: "oil for frying", ingredientId: "i-oil", key: "key-oil" }],
  estimatedByAI: [],
  counted: [
    { lineId: "rice", name: "rice", grams: 200, calories: 700, fat: 2, carbs: 156, protein: 14 },
  ],
  estimated: false,
  credits: ["ciqual"],
  household: false,
};

function job(overrides: Partial<RecipeEnrichmentJobData> = {}): Job<RecipeEnrichmentJobData> {
  return {
    id: "job-1",
    data: {
      recipeId: "recipe-1",
      kind: "nutrition-estimation",
      userId: "user-1",
      householdKey: "household-1",
      householdUserIds: ["user-1"],
      origin: "automatic",
      ...overrides,
    },
    attemptsMade: 0,
    opts: { attempts: 3 },
  } as Job<RecipeEnrichmentJobData>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getRecipeFull.mockResolvedValue(RECIPE);
  mocks.estimate.mockResolvedValue(ESTIMATE);
  mocks.workOut.mockResolvedValue(WORKED);
  mocks.saveRecipeNutritionEstimate.mockResolvedValue(true);
  mocks.clearRecipeNutritionEstimate.mockResolvedValue(false);
  mocks.replaceRecipeNutrition.mockResolvedValue(true);
});

describe("processNutritionEstimationJob", () => {
  it("estimates only the lines left out, given the counted ones, and stores the share apart", async () => {
    await processNutritionEstimationJob(job());

    expect(mocks.estimate).toHaveBeenCalledWith(
      "Fried rice",
      2,
      [{ ingredientName: "oil for frying", amount: null, unit: null }],
      [
        expect.objectContaining({
          text: "200 gram rice",
          calories: 700,
          fat: 2,
          carbs: 156,
          protein: 14,
        }),
      ]
    );
    expect(mocks.saveRecipeNutritionEstimate).toHaveBeenCalledWith("recipe-1", {
      ...ESTIMATE,
      lines: ["key-oil"],
    });
    expect(mocks.replaceRecipeNutrition).not.toHaveBeenCalled();
    // The share is the recipe's news: open pages are sent the recipe again.
    expect(mocks.publishRecipeUpdated).toHaveBeenCalled();
  });

  it("asks the model nothing where every line counts, and drops an earlier estimate", async () => {
    mocks.workOut.mockResolvedValue({ ...WORKED, uncounted: [] });

    await processNutritionEstimationJob(job({ origin: "manual", requestedByUserId: "user-1" }));

    expect(mocks.estimate).not.toHaveBeenCalled();
    expect(mocks.saveRecipeNutritionEstimate).not.toHaveBeenCalled();
    expect(mocks.clearRecipeNutritionEstimate).toHaveBeenCalledWith("recipe-1");
  });

  it("estimates a recipe that supplies nutrition of its own as a whole, as before", async () => {
    mocks.getRecipeFull.mockResolvedValue({ ...RECIPE, calories: 300 });

    await processNutritionEstimationJob(job({ origin: "manual", requestedByUserId: "user-1" }));

    expect(mocks.workOut).not.toHaveBeenCalled();
    expect(mocks.estimate).toHaveBeenCalledWith("Fried rice", 2, [
      { ingredientName: "rice", amount: 200, unit: "gram" },
      { ingredientName: "oil for frying", amount: null, unit: null },
    ]);
    expect(mocks.replaceRecipeNutrition).toHaveBeenCalledWith("recipe-1", ESTIMATE, "replace");
  });
});
