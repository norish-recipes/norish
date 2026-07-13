// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const getRecipeFull = vi.fn();
const updateRecipeWithRefs = vi.fn();
const emitByPolicy = vi.fn();
const estimateNutritionFromIngredients = vi.fn();

vi.mock("@norish/db", () => ({
  getRecipeFull,
  updateRecipeWithRefs,
}));

vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getRecipePermissionPolicy: vi.fn().mockResolvedValue({ view: "everyone" }),
}));

vi.mock("@norish/queue/api-handlers", () => ({
  requireQueueApiHandler: vi.fn(() => estimateNutritionFromIngredients),
}));

vi.mock("@norish/shared-server/realtime/policy", () => ({
  emitByPolicy,
}));

vi.mock("@norish/shared-server/realtime/recipes", () => ({
  recipeEmitter: {},
}));

vi.mock("@norish/shared-server/logger", () => ({
  createLogger: () => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const recipe = {
  id: "recipe-123",
  name: "Spaghettini aglio e olio",
  servings: 4,
  recipeIngredients: [
    { ingredientName: "Spaghettini", amount: 600, unit: "gram" },
    { ingredientName: "Olivenöl", amount: 80, unit: "milliliter" },
    { ingredientName: "Salz", amount: null, unit: null },
  ],
};

const job = {
  id: "job-1",
  attemptsMade: 0,
  opts: {},
  data: {
    recipeId: "recipe-123",
    userId: "user-1",
    householdKey: "household-1",
  },
} as any;

describe("processNutritionJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRecipeFull.mockResolvedValue(recipe);
  });

  it("saves the estimate and emits an update on success", async () => {
    const { processNutritionJob } = await import("../../src/nutrition-estimation/worker");

    estimateNutritionFromIngredients.mockResolvedValue({
      success: true,
      data: { calories: 700, fat: 20, carbs: 110, protein: 21 },
    });

    await processNutritionJob(job);

    expect(updateRecipeWithRefs).toHaveBeenCalledWith("recipe-123", "user-1", {
      calories: 700,
      fat: "20",
      carbs: "110",
      protein: "21",
    });
    expect(emitByPolicy).toHaveBeenCalledWith(
      expect.anything(),
      "everyone",
      expect.anything(),
      "updated",
      expect.anything()
    );
  });

  it("throws on estimation failure so BullMQ retries, leaving the recipe unchanged", async () => {
    const { processNutritionJob } = await import("../../src/nutrition-estimation/worker");

    estimateNutritionFromIngredients.mockResolvedValue({
      success: false,
      error: "Nutrition estimation returned all-zero values",
      code: "INVALID_OUTPUT",
    });

    await expect(processNutritionJob(job)).rejects.toThrow(
      "Nutrition estimation returned all-zero values"
    );

    expect(updateRecipeWithRefs).not.toHaveBeenCalled();
    expect(emitByPolicy).not.toHaveBeenCalled();
  });
});
