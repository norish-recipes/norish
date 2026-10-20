// @vitest-environment node

import type { Job } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ImageImportJobData } from "@norish/queue/contracts/job-types";
import { MAX_RECIPE_IMAGES } from "@norish/shared/lib/recipe-media";

const createRecipeWithRefs = vi.fn();
const dashboardRecipe = vi.fn();
const getAllergiesForUsers = vi.fn();
const addRecipeImages = vi.fn();
const updateRecipeDishColor = vi.fn();
const publishRecipe = vi.fn(async () => undefined);
const extractRecipeFromImages = vi.fn();
const saveImageBytes = vi.fn();
const dishColorForImageUrl = vi.fn();

vi.mock("@norish/db", () => ({
  addRecipeImages,
  createRecipeWithRefs,
  dashboardRecipe,
  getAllergiesForUsers,
  updateRecipeDishColor,
}));

vi.mock("@norish/shared-server/media/dish-color", () => ({
  dishColorForImageUrl,
}));

vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getAIConfig: vi.fn().mockResolvedValue({
    automaticEnrichment: {
      autoTagging: false,
      allergyDetection: false,
      autoCategorization: false,
      nutritionEstimation: false,
    },
  }),
  getRecipePermissionPolicy: vi.fn().mockResolvedValue({ view: "everyone" }),
}));

vi.mock("@norish/queue/api-handlers", () => ({
  requireQueueApiHandler: vi.fn(() => extractRecipeFromImages),
}));

vi.mock("@norish/shared-server/realtime/recipes", () => ({
  recipes: { publish: publishRecipe },
}));

// Resolution reads the catalogue; these tests are about the worker, not it.
vi.mock("@norish/shared-server/ingredients/recipe-lines", () => ({
  withResolvedIngredients: vi.fn(async (payload: object) => ({
    ...payload,
    ingredientResolutions: new Map(),
  })),
  createResolvedRecipe: vi.fn(async (id: string, userId: unknown, payload: object) =>
    createRecipeWithRefs(id, userId, { ...payload, ingredientResolutions: new Map() })
  ),
}));

vi.mock("@norish/shared-server/logger", () => ({
  createLogger: () => ({ info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

vi.mock("@norish/shared-server/media/storage", () => ({
  deleteRecipeImagesDir: vi.fn(),
  saveImageBytes,
}));

function jobWithFiles(contents: string[]): Job<ImageImportJobData> {
  return {
    id: "job",
    attemptsMade: 0,
    opts: {},
    data: {
      recipeId: "recipe-123",
      userId: "user-1",
      householdKey: "household-1",
      householdUserIds: null,
      files: contents.map((content, index) => ({
        data: Buffer.from(content).toString("base64"),
        mimeType: "image/jpeg",
        filename: `recipe-${index}.jpg`,
      })),
    },
  } as unknown as Job<ImageImportJobData>;
}

describe("processImageImportJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    extractRecipeFromImages.mockResolvedValue({
      id: "recipe-123",
      name: "Extracted Recipe",
      description: null,
      notes: null,
      url: null,
      image: null,
      servings: 2,
      prepMinutes: null,
      cookMinutes: null,
      totalMinutes: null,
      calories: null,
      fat: null,
      carbs: null,
      protein: null,
      systemUsed: "metric",
      recipeIngredients: [
        {
          ingredientId: null,
          ingredientName: "Flour",
          amount: 1,
          unit: "cup",
          systemUsed: "metric",
          order: 0,
        },
      ],
      steps: [{ step: "Mix", order: 1, systemUsed: "metric" }],
      tags: [],
      categories: [],
      images: [],
      videos: [],
    });
    createRecipeWithRefs.mockResolvedValue({ status: "inserted", recipeId: "recipe-123" });
    dashboardRecipe.mockResolvedValue({ id: "recipe-123", name: "Extracted Recipe" });
    saveImageBytes.mockResolvedValue("/recipes/recipe-123/uploaded.jpg");
    dishColorForImageUrl.mockResolvedValue("#5a3c21");
  });

  it("passes the job recipeId through extraction and image persistence", async () => {
    const { processImageImportJob } = await import("../../src/image-import/worker");

    await processImageImportJob({
      id: "job-1",
      attemptsMade: 0,
      opts: {},
      data: {
        recipeId: "recipe-123",
        userId: "user-1",
        householdKey: "household-1",
        householdUserIds: null,
        files: [
          {
            data: Buffer.from("img").toString("base64"),
            mimeType: "image/jpeg",
            filename: "recipe.jpg",
          },
        ],
      },
    } as any);

    expect(extractRecipeFromImages).toHaveBeenCalledWith("recipe-123", expect.any(Array));
    expect(createRecipeWithRefs).toHaveBeenCalledWith(
      "recipe-123",
      "user-1",
      expect.objectContaining({ id: "recipe-123", name: "Extracted Recipe" })
    );
    expect(saveImageBytes).toHaveBeenCalledWith(expect.any(Buffer), "recipe-123");
    expect(addRecipeImages).toHaveBeenCalledWith("recipe-123", [
      { image: "/recipes/recipe-123/uploaded.jpg", order: 0 },
    ]);
  });

  it("stores the Dish Colour extracted from the saved image (vision path)", async () => {
    const { processImageImportJob } = await import("../../src/image-import/worker");

    await processImageImportJob({
      id: "job-2",
      attemptsMade: 0,
      opts: {},
      data: {
        recipeId: "recipe-123",
        userId: "user-1",
        householdKey: "household-1",
        householdUserIds: null,
        files: [
          {
            data: Buffer.from("img").toString("base64"),
            mimeType: "image/jpeg",
            filename: "recipe.jpg",
          },
        ],
      },
    } as unknown as Job<ImageImportJobData>);

    expect(dishColorForImageUrl).toHaveBeenCalledWith("/recipes/recipe-123/uploaded.jpg");
    expect(updateRecipeDishColor).toHaveBeenCalledWith("recipe-123", "#5a3c21");
  });

  it("saves every uploaded file as its own Source Image, in upload order", async () => {
    saveImageBytes
      .mockResolvedValueOnce("/recipes/recipe-123/first.jpg")
      .mockResolvedValueOnce("/recipes/recipe-123/second.jpg")
      .mockResolvedValueOnce("/recipes/recipe-123/third.jpg");

    const { processImageImportJob } = await import("../../src/image-import/worker");

    await processImageImportJob(jobWithFiles(["first", "second", "third"]));

    expect(saveImageBytes).toHaveBeenCalledTimes(3);
    expect(saveImageBytes.mock.calls.map(([bytes]) => String(bytes))).toEqual([
      "first",
      "second",
      "third",
    ]);
    expect(addRecipeImages).toHaveBeenCalledWith("recipe-123", [
      { image: "/recipes/recipe-123/first.jpg", order: 0 },
      { image: "/recipes/recipe-123/second.jpg", order: 1 },
      { image: "/recipes/recipe-123/third.jpg", order: 2 },
    ]);
    expect(dishColorForImageUrl).toHaveBeenCalledWith("/recipes/recipe-123/first.jpg");
    expect(updateRecipeDishColor).toHaveBeenCalledWith("recipe-123", "#5a3c21");
  });

  it("stops at the Source Image cap", async () => {
    saveImageBytes.mockImplementation(
      async (bytes: Buffer) => `/recipes/recipe-123/${String(bytes)}.jpg`
    );

    const contents = Array.from({ length: MAX_RECIPE_IMAGES + 2 }, (_, index) => `img-${index}`);

    const { processImageImportJob } = await import("../../src/image-import/worker");

    await processImageImportJob(jobWithFiles(contents));

    expect(saveImageBytes).toHaveBeenCalledTimes(MAX_RECIPE_IMAGES);
    expect(addRecipeImages).toHaveBeenCalledTimes(1);

    const [recipeId, images] = addRecipeImages.mock.calls[0]!;

    expect(recipeId).toBe("recipe-123");
    expect(images).toHaveLength(MAX_RECIPE_IMAGES);
    expect(images.map((image: { order: number }) => image.order)).toEqual(
      Array.from({ length: MAX_RECIPE_IMAGES }, (_, index) => index)
    );
  });
});
