// @vitest-environment node

import type { Queue } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { NutritionEstimationJobData } from "@norish/queue/contracts/job-types";

const mocked = vi.hoisted(() => ({
  add: vi.fn(),
  getAIConfig: vi.fn(),
  getRecipeFull: vi.fn(),
  isJobInQueue: vi.fn(),
}));

vi.mock("@norish/db", () => ({
  getRecipeFull: mocked.getRecipeFull,
}));

vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getAIConfig: mocked.getAIConfig,
}));

vi.mock("@norish/queue/helpers", () => ({
  isJobInQueue: mocked.isJobInQueue,
}));

vi.mock("@norish/shared-server/logger", () => ({
  createLogger: () => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

describe("addAutoNutritionEstimationJob", () => {
  const data: NutritionEstimationJobData = {
    recipeId: "recipe-123",
    userId: "user-123",
    householdKey: "household-123",
    householdUserIds: ["user-123"],
  };
  const queue = {
    add: mocked.add,
  } as unknown as Queue<NutritionEstimationJobData>;

  beforeEach(() => {
    vi.clearAllMocks();
    mocked.getAIConfig.mockResolvedValue({ enabled: true, autoEstimateNutrition: true });
    mocked.getRecipeFull.mockResolvedValue({
      calories: null,
      fat: null,
      carbs: null,
      protein: null,
      recipeIngredients: [{ ingredientName: "Flour" }],
    });
    mocked.isJobInQueue.mockResolvedValue(false);
    mocked.add.mockResolvedValue({ id: "nutrition_recipe-123" });
  });

  it.each([
    ["AI is disabled", { enabled: false, autoEstimateNutrition: true }],
    ["automatic estimation is disabled", { enabled: true, autoEstimateNutrition: false }],
  ])("skips when %s", async (_description, aiConfig) => {
    mocked.getAIConfig.mockResolvedValue(aiConfig);
    const { addAutoNutritionEstimationJob } =
      await import("@norish/queue/nutrition-estimation/producer");

    const result = await addAutoNutritionEstimationJob(queue, data);

    expect(result).toEqual({ status: "skipped", reason: "disabled" });
    expect(mocked.getRecipeFull).not.toHaveBeenCalled();
    expect(mocked.add).not.toHaveBeenCalled();
  });

  it.each([
    ["calories", { calories: 250 }],
    ["fat", { fat: "10" }],
    ["carbohydrates", { carbs: "30" }],
    ["protein", { protein: "12" }],
  ])("does not overwrite imported %s", async (_description, nutrition) => {
    mocked.getRecipeFull.mockResolvedValue({
      calories: null,
      fat: null,
      carbs: null,
      protein: null,
      recipeIngredients: [{ ingredientName: "Flour" }],
      ...nutrition,
    });
    const { addAutoNutritionEstimationJob } =
      await import("@norish/queue/nutrition-estimation/producer");

    const result = await addAutoNutritionEstimationJob(queue, data);

    expect(result).toEqual({ status: "skipped", reason: "existing_nutrition" });
    expect(mocked.add).not.toHaveBeenCalled();
  });

  it("skips recipes without ingredients", async () => {
    mocked.getRecipeFull.mockResolvedValue({
      calories: null,
      fat: null,
      carbs: null,
      protein: null,
      recipeIngredients: [],
    });
    const { addAutoNutritionEstimationJob } =
      await import("@norish/queue/nutrition-estimation/producer");

    const result = await addAutoNutritionEstimationJob(queue, data);

    expect(result).toEqual({ status: "skipped", reason: "no_ingredients" });
    expect(mocked.add).not.toHaveBeenCalled();
  });

  it("queues estimation for imported recipes without nutrition", async () => {
    const { addAutoNutritionEstimationJob } =
      await import("@norish/queue/nutrition-estimation/producer");

    const result = await addAutoNutritionEstimationJob(queue, data);

    expect(result.status).toBe("queued");
    expect(mocked.add).toHaveBeenCalledWith("estimate", data, {
      jobId: "nutrition_recipe-123",
    });
  });
});
