// @vitest-environment node

import type { Job } from "bullmq";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { getRecipeFull } from "@norish/db";
import { getAverageRating, getUserRatingWithVersion } from "@norish/db/repositories/ratings";

import type { PasteImportJobData } from "../../src/contracts/job-types";
import { RepositoryTestBase } from "../../../db/__tests__/helpers/repository-test-base";
import { processPasteImportJob } from "../../src/paste-import/worker";

const mocked = vi.hoisted(() => ({
  addAutoTaggingJob: vi.fn(),
  addAllergyDetectionJob: vi.fn(),
  emitByPolicy: vi.fn(),
}));

vi.mock("@norish/config/server-config-loader", () => ({
  getAIConfig: vi.fn().mockResolvedValue({ autoTagAllergies: false }),
  getRecipePermissionPolicy: vi.fn().mockResolvedValue({ view: "everyone" }),
  isAIEnabled: vi.fn().mockResolvedValue(true),
}));

vi.mock("@norish/queue/registry", () => ({
  getQueues: vi.fn(() => ({ autoTagging: {}, allergyDetection: {} })),
}));

vi.mock("@norish/queue/auto-tagging/producer", () => ({
  addAutoTaggingJob: mocked.addAutoTaggingJob,
}));

vi.mock("@norish/queue/allergy-detection/producer", () => ({
  addAllergyDetectionJob: mocked.addAllergyDetectionJob,
}));

vi.mock("@norish/trpc/helpers", () => ({
  emitByPolicy: mocked.emitByPolicy,
}));

vi.mock("@norish/trpc/routers/recipes/emitter", () => ({
  recipeEmitter: {},
}));

vi.mock("@norish/shared-server/logger", () => ({
  createLogger: () => ({ info: vi.fn(), debug: vi.fn(), error: vi.fn() }),
}));

vi.mock("@norish/shared-server/media/storage", () => ({
  deleteRecipeImagesDir: vi.fn(),
}));

describe("processPasteImportJob integration", () => {
  const testBase = new RepositoryTestBase("test_paste_import_worker");
  let userId: string;

  beforeAll(async () => {
    await testBase.setup();
  });

  beforeEach(async () => {
    const [user] = await testBase.beforeEachTest();

    userId = user.id;
    mocked.addAutoTaggingJob.mockReset();
    mocked.addAllergyDetectionJob.mockReset();
    mocked.emitByPolicy.mockReset();
  });

  afterAll(async () => {
    await testBase.teardown();
  });

  it("persists created recipes and imported user ratings in the database", async () => {
    const result = await processPasteImportJob({
      id: "job-integration-1",
      attemptsMade: 0,
      opts: {},
      data: {
        batchId: "batch-integration-1",
        recipeIds: ["123e4567-e89b-42d3-a456-426614174001", "123e4567-e89b-42d3-a456-426614174002"],
        userId,
        householdKey: "household-test",
        householdUserIds: [userId],
        text: "structured",
        structuredRecipes: [
          {
            recipeId: "123e4567-e89b-42d3-a456-426614174001",
            importedRating: 4.6,
            recipe: {
              name: "First Structured Recipe",
              description: "From integration test",
              notes: null,
              url: "https://example.com/first",
              image: null,
              servings: 2,
              prepMinutes: 10,
              cookMinutes: 5,
              totalMinutes: 15,
              calories: 300,
              fat: "12",
              carbs: "30",
              protein: "18",
              systemUsed: "metric",
              recipeIngredients: [
                {
                  ingredientId: null,
                  ingredientName: "Eggs",
                  amount: 2,
                  unit: null,
                  systemUsed: "metric",
                  order: 0,
                },
              ],
              steps: [{ step: "Whisk eggs", order: 1, systemUsed: "metric" }],
              tags: [{ name: "breakfast" }],
              categories: ["Breakfast"],
              images: [],
              videos: [],
            },
          },
          {
            recipeId: "123e4567-e89b-42d3-a456-426614174002",
            importedRating: 2.2,
            recipe: {
              name: "Second Structured Recipe",
              description: null,
              notes: "Second note",
              url: "https://example.com/second",
              image: null,
              servings: 4,
              prepMinutes: 20,
              cookMinutes: 15,
              totalMinutes: 35,
              calories: 450,
              fat: "20",
              carbs: "40",
              protein: "22",
              systemUsed: "metric",
              recipeIngredients: [
                {
                  ingredientId: null,
                  ingredientName: "Milk",
                  amount: 1,
                  unit: "cup",
                  systemUsed: "metric",
                  order: 0,
                },
              ],
              steps: [{ step: "Heat milk", order: 1, systemUsed: "metric" }],
              tags: [{ name: "quick" }],
              categories: ["Dinner"],
              images: [],
              videos: [],
            },
          },
        ],
      },
    } as Job<PasteImportJobData>);

    expect(result).toEqual({
      recipeIds: ["123e4567-e89b-42d3-a456-426614174001", "123e4567-e89b-42d3-a456-426614174002"],
    });

    const firstRecipe = await getRecipeFull("123e4567-e89b-42d3-a456-426614174001");
    const secondRecipe = await getRecipeFull("123e4567-e89b-42d3-a456-426614174002");
    const firstUserRating = await getUserRatingWithVersion(
      userId,
      "123e4567-e89b-42d3-a456-426614174001"
    );
    const secondUserRating = await getUserRatingWithVersion(
      userId,
      "123e4567-e89b-42d3-a456-426614174002"
    );
    const firstStats = await getAverageRating("123e4567-e89b-42d3-a456-426614174001");
    const secondStats = await getAverageRating("123e4567-e89b-42d3-a456-426614174002");

    expect(firstRecipe?.name).toBe("First Structured Recipe");
    expect(secondRecipe?.name).toBe("Second Structured Recipe");
    expect(firstRecipe?.recipeIngredients).toHaveLength(1);
    expect(secondRecipe?.steps).toHaveLength(1);
    expect(firstUserRating.rating).toBe(5);
    expect(secondUserRating.rating).toBe(2);
    expect(firstStats).toEqual({ averageRating: 5, ratingCount: 1 });
    expect(secondStats).toEqual({ averageRating: 2, ratingCount: 1 });
    expect(mocked.addAutoTaggingJob).toHaveBeenCalledTimes(2);
    expect(mocked.addAllergyDetectionJob).toHaveBeenCalledTimes(2);
  });
});
