// @vitest-environment node

import type { Job } from "bullmq";
import { UnrecoverableError } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ImageImportJobData } from "@norish/queue/contracts/job-types";

const createRecipeWithRefs = vi.fn();
const dashboardRecipe = vi.fn();
const getAllergiesForUsers = vi.fn();
const getRecipeOwnerId = vi.fn();
const addRecipeImages = vi.fn();
const updateRecipeDishColor = vi.fn();
const publishRecipe = vi.fn(async () => undefined);
const publishRecipeBecameUsable = vi.fn(async () => undefined);
const extractRecipeFromImages = vi.fn();
const saveImageBytes = vi.fn();
const deleteRecipeImagesDir = vi.fn();
const dishColorForImageUrl = vi.fn();
const settleImageImportBatchItem = vi.fn();

const queueStub = {};

vi.mock("@norish/db", () => ({
  addRecipeImages,
  createRecipeWithRefs,
  dashboardRecipe,
  getAllergiesForUsers,
  getRecipeOwnerId,
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

vi.mock("@norish/shared-server/realtime/recipe-enrichment", () => ({
  recipeEnrichment: { publish: publishRecipeBecameUsable },
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
  deleteRecipeImagesDir,
  saveImageBytes,
}));

vi.mock("../../src/registry", () => ({
  getQueues: vi.fn(() => ({ imageImport: queueStub })),
}));

vi.mock("../../src/image-import/batch", () => ({
  settleImageImportBatchItem,
}));

function jobOf(
  overrides: Partial<ImageImportJobData> = {},
  jobOverrides: { attemptsMade?: number; opts?: { attempts?: number } } = {}
): Job<ImageImportJobData> {
  return {
    id: "job-1",
    attemptsMade: jobOverrides.attemptsMade ?? 0,
    opts: jobOverrides.opts ?? {},
    updateData: vi.fn(async () => undefined),
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
      ...overrides,
    },
  } as unknown as Job<ImageImportJobData>;
}

function batchJobOf(
  overrides: Partial<ImageImportJobData> = {},
  jobOverrides: { attemptsMade?: number; opts?: { attempts?: number } } = {}
): Job<ImageImportJobData> {
  return jobOf({ batchId: "batch-1", batchItemId: "item-1", ...overrides }, jobOverrides);
}

describe("processImageImportJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRecipeOwnerId.mockResolvedValue(null);

    extractRecipeFromImages.mockResolvedValue({
      id: "recipe-123",
      name: "Extracted Recipe",
      description: null,
      notes: null,
      url: "https://same.example/recipe",
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

    await processImageImportJob(jobOf());

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

    await processImageImportJob(jobOf());

    expect(dishColorForImageUrl).toHaveBeenCalledWith("/recipes/recipe-123/uploaded.jpg");
    expect(updateRecipeDishColor).toHaveBeenCalledWith("recipe-123", "#5a3c21");
  });

  it("settles a bulk item done once its recipe exists", async () => {
    const { processImageImportJob } = await import("../../src/image-import/worker");

    await processImageImportJob(batchJobOf());

    expect(settleImageImportBatchItem).toHaveBeenCalledWith(
      queueStub,
      expect.objectContaining({
        batchId: "batch-1",
        itemId: "item-1",
        recipeId: "recipe-123",
      })
    );
  });

  it("clears the extracted source URL for a batch item", async () => {
    const { processImageImportJob } = await import("../../src/image-import/worker");

    await processImageImportJob(batchJobOf());

    expect(createRecipeWithRefs).toHaveBeenCalledWith(
      "recipe-123",
      "user-1",
      expect.objectContaining({ url: null })
    );
  });

  it("keeps a source URL for a single import", async () => {
    const { processImageImportJob } = await import("../../src/image-import/worker");

    await processImageImportJob(jobOf());

    expect(createRecipeWithRefs).toHaveBeenCalledWith(
      "recipe-123",
      "user-1",
      expect.objectContaining({ url: "https://same.example/recipe" })
    );
  });

  it("announces a bulk recipe without automatic enrichment", async () => {
    const { processImageImportJob } = await import("../../src/image-import/worker");

    await processImageImportJob(batchJobOf({ autoEnrich: false }));

    expect(publishRecipeBecameUsable).toHaveBeenCalledWith(
      "recipeBecameUsable",
      expect.objectContaining({ recipeId: "recipe-123", autoEnrich: false }),
      undefined
    );
  });

  it("leaves the auto-enrich choice off a single import announcement", async () => {
    const { processImageImportJob } = await import("../../src/image-import/worker");

    await processImageImportJob(jobOf());

    const payload = publishRecipeBecameUsable.mock.calls[0]?.[1] as { autoEnrich?: boolean };

    expect(payload.autoEnrich).toBeUndefined();
  });

  it("fails a batch item that would reuse an existing recipe", async () => {
    const { processImageImportJob } = await import("../../src/image-import/worker");
    createRecipeWithRefs.mockResolvedValue({ status: "existing", recipeId: "first-recipe" });

    await expect(processImageImportJob(batchJobOf())).rejects.toBeInstanceOf(UnrecoverableError);

    expect(saveImageBytes).not.toHaveBeenCalled();
    expect(addRecipeImages).not.toHaveBeenCalled();
    expect(settleImageImportBatchItem).not.toHaveBeenCalled();
  });

  it("finishes a retried bulk item without extracting a second time when its recipe already landed", async () => {
    const { processImageImportJob } = await import("../../src/image-import/worker");
    getRecipeOwnerId.mockResolvedValue("user-1");

    await processImageImportJob(batchJobOf());

    expect(extractRecipeFromImages).not.toHaveBeenCalled();
    expect(createRecipeWithRefs).not.toHaveBeenCalled();
    expect(settleImageImportBatchItem).toHaveBeenCalledWith(
      queueStub,
      expect.objectContaining({ batchId: "batch-1", itemId: "item-1", recipeId: "recipe-123" })
    );
  });

  it("refuses an item whose recipe belongs to another user", async () => {
    const { processImageImportJob } = await import("../../src/image-import/worker");
    getRecipeOwnerId.mockResolvedValue("someone-else");

    await expect(processImageImportJob(batchJobOf())).rejects.toThrow(
      "Bulk image import recipe belongs to another user"
    );
    expect(extractRecipeFromImages).not.toHaveBeenCalled();
  });
});

describe("handleImageImportJobFailed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRecipeOwnerId.mockResolvedValue(null);
  });

  it("removes the source image and reports a final bulk failure", async () => {
    const { handleImageImportJobFailed } = await import("../../src/image-import/worker");
    const job = batchJobOf({}, { attemptsMade: 2, opts: { attempts: 2 } });

    await handleImageImportJobFailed(job, new Error("no recipe"));

    expect(deleteRecipeImagesDir).toHaveBeenCalledWith("recipe-123");
    expect(job.updateData).toHaveBeenCalledWith(expect.objectContaining({ files: [] }));
    expect(settleImageImportBatchItem).toHaveBeenCalledWith(
      queueStub,
      expect.objectContaining({
        batchId: "batch-1",
        itemId: "item-1",
        errorCode: "extraction-failed",
      })
    );
  });

  it("keeps the source image while a bulk item still has an attempt left", async () => {
    const { handleImageImportJobFailed } = await import("../../src/image-import/worker");

    await handleImageImportJobFailed(
      batchJobOf({}, { attemptsMade: 1, opts: { attempts: 2 } }),
      new Error("temporary")
    );

    expect(deleteRecipeImagesDir).not.toHaveBeenCalled();
    expect(settleImageImportBatchItem).not.toHaveBeenCalled();
  });

  it("settles an unrecoverable failure on the first attempt", async () => {
    const { handleImageImportJobFailed } = await import("../../src/image-import/worker");
    const job = batchJobOf({}, { attemptsMade: 1, opts: { attempts: 3 } });

    await handleImageImportJobFailed(job, new UnrecoverableError("bad image"));

    expect(deleteRecipeImagesDir).toHaveBeenCalledWith("recipe-123");
    expect(job.updateData).toHaveBeenCalledWith(expect.objectContaining({ files: [] }));
    expect(settleImageImportBatchItem).toHaveBeenCalledWith(
      queueStub,
      expect.objectContaining({
        batchId: "batch-1",
        itemId: "item-1",
        errorCode: "extraction-failed",
      })
    );
  });

  it("does not publish a failure when the recipe landed", async () => {
    const { handleImageImportJobFailed } = await import("../../src/image-import/worker");
    getRecipeOwnerId.mockResolvedValue("user-1");

    await handleImageImportJobFailed(
      batchJobOf({}, { attemptsMade: 2, opts: { attempts: 2 } }),
      new Error("announce failed")
    );

    expect(publishRecipe).not.toHaveBeenCalled();
  });

  it("settles done when the recipe landed before the final failure", async () => {
    const { handleImageImportJobFailed } = await import("../../src/image-import/worker");
    getRecipeOwnerId.mockResolvedValue("user-1");

    await handleImageImportJobFailed(
      batchJobOf({}, { attemptsMade: 2, opts: { attempts: 2 } }),
      new Error("announce failed")
    );

    expect(deleteRecipeImagesDir).not.toHaveBeenCalled();
    expect(settleImageImportBatchItem).toHaveBeenCalledWith(
      queueStub,
      expect.objectContaining({ recipeId: "recipe-123" })
    );
  });

  it("keeps the existing single import cleanup on every failed attempt", async () => {
    const { handleImageImportJobFailed } = await import("../../src/image-import/worker");

    await handleImageImportJobFailed(
      jobOf({}, { attemptsMade: 1, opts: { attempts: 2 } }),
      new Error("temporary")
    );

    expect(deleteRecipeImagesDir).toHaveBeenCalledWith("recipe-123");
    expect(publishRecipe).toHaveBeenCalledWith(
      "failed",
      expect.objectContaining({ recipeId: "recipe-123" }),
      expect.anything()
    );
  });

  it("does not touch a foreign recipe's images on a bulk failure", async () => {
    const { handleImageImportJobFailed } = await import("../../src/image-import/worker");
    getRecipeOwnerId.mockResolvedValue("another-user");

    await handleImageImportJobFailed(
      batchJobOf({}, { attemptsMade: 2, opts: { attempts: 2 } }),
      new Error("no recipe")
    );

    expect(deleteRecipeImagesDir).not.toHaveBeenCalled();
    expect(settleImageImportBatchItem).toHaveBeenCalledWith(
      queueStub,
      expect.objectContaining({ errorCode: "extraction-failed" })
    );
  });
});
