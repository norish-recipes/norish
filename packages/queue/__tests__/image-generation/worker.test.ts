// @vitest-environment node
/**
 * The image-generation worker owns its orchestration and nothing else: the
 * brief request before the image request, one storage operation, the Dish
 * Colour recompute, and the lifecycle it publishes. It holds no database
 * handle and composes no queries — the storage operation is the only write.
 */
import type { Job } from "bullmq";
import { UnrecoverableError } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RecipeEnrichmentJobData } from "@norish/queue/contracts/job-types";
import { AIProviderError, AIResponseError } from "@norish/shared-server/ai/runtime/errors";

const mocks = vi.hoisted(() => ({
  getRecipeFull: vi.fn(),
  publishLifecycle: vi.fn(),
  publishRecipeUpdated: vi.fn(),
  reportStep: vi.fn(),
  writeVisualBrief: vi.fn(),
  generateImage: vi.fn(),
  storeGeneratedRecipeImage: vi.fn(),
  refreshDishColorForRecipe: vi.fn(),
}));

vi.mock("@norish/db", () => ({ getRecipeFull: mocks.getRecipeFull }));

vi.mock("@norish/db/drizzle", () => ({
  get db(): never {
    throw new Error("The worker must not hold a database handle");
  },
}));

vi.mock("@norish/shared-server/ai/enrichment/image-briefer", () => ({
  writeVisualBrief: mocks.writeVisualBrief,
}));

vi.mock("@norish/shared-server/ai/runtime/runtime", () => ({
  generateImage: mocks.generateImage,
}));

vi.mock("@norish/shared-server/media/generated-image", () => ({
  storeGeneratedRecipeImage: mocks.storeGeneratedRecipeImage,
}));

vi.mock("@norish/shared-server/media/dish-color", () => ({
  refreshDishColorForRecipe: mocks.refreshDishColorForRecipe,
}));

vi.mock("@norish/shared-server/logger", () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

vi.mock("../../src/enrichment/announce", () => ({
  publishEnrichmentLifecycle: mocks.publishLifecycle,
  publishEnrichmentRecipeUpdated: mocks.publishRecipeUpdated,
}));

vi.mock("../../src/job-steps", () => ({ reportStep: mocks.reportStep }));

const { processImageGenerationJob } = await import("../../src/image-generation/worker");

const RECIPE = {
  id: "recipe-1",
  name: "Erwtensoep",
  description: "Dikke Hollandse snert.",
  recipeIngredients: [{ ingredientName: "spliterwten" }, { ingredientName: "rookworst" }],
  images: [],
  image: null,
};

const IMAGE_BYTES = Buffer.from("drawn-jpeg-bytes");

function jobFor(overrides: Partial<RecipeEnrichmentJobData> = {}): Job<RecipeEnrichmentJobData> {
  const data: RecipeEnrichmentJobData = {
    recipeId: "recipe-1",
    kind: "image-generation",
    userId: "user-1",
    householdKey: "household-1",
    householdUserIds: ["user-1"],
    origin: "automatic",
    ...overrides,
  };

  return {
    id: "job-1",
    data,
    attemptsMade: 0,
    opts: { attempts: 3 },
  } as Job<RecipeEnrichmentJobData>;
}

beforeEach(() => {
  mocks.getRecipeFull.mockResolvedValue(RECIPE);
  mocks.writeVisualBrief.mockResolvedValue("A thick green pea soup in a bowl.");
  mocks.generateImage.mockResolvedValue({ bytes: IMAGE_BYTES, mediaType: "image/jpeg" });
  mocks.storeGeneratedRecipeImage.mockResolvedValue("/recipes/recipe-1/drawn.jpg");
  mocks.refreshDishColorForRecipe.mockResolvedValue(undefined);
});

describe("processImageGenerationJob", () => {
  it("writes the brief first, draws from it, and stores through the one operation", async () => {
    await processImageGenerationJob(jobFor());

    expect(mocks.writeVisualBrief).toHaveBeenCalledWith({
      title: "Erwtensoep",
      description: "Dikke Hollandse snert.",
      ingredients: ["spliterwten", "rookworst"],
    });
    // The brief goes to the image model appended after the style prompt.
    expect(mocks.generateImage).toHaveBeenCalledWith({
      prompt: "image-generation-style",
      sections: ["A thick green pea soup in a bowl."],
    });
    expect(mocks.writeVisualBrief.mock.invocationCallOrder[0]!).toBeLessThan(
      mocks.generateImage.mock.invocationCallOrder[0]!
    );
    expect(mocks.storeGeneratedRecipeImage).toHaveBeenCalledWith("recipe-1", IMAGE_BYTES);
  });

  it("recomputes the Dish Colour before the canonical recipe update goes out", async () => {
    await processImageGenerationJob(jobFor());

    expect(mocks.refreshDishColorForRecipe).toHaveBeenCalledWith("recipe-1");
    expect(mocks.refreshDishColorForRecipe.mock.invocationCallOrder[0]!).toBeLessThan(
      mocks.publishRecipeUpdated.mock.invocationCallOrder[0]!
    );
  });

  it("publishes the shared lifecycle and the canonical recipe update", async () => {
    await processImageGenerationJob(jobFor());

    expect(mocks.publishLifecycle.mock.calls.map(([, state]) => state)).toEqual([
      "processing",
      "succeeded",
    ]);
    expect(mocks.publishRecipeUpdated).toHaveBeenCalledTimes(1);
  });

  it("fails rather than succeeding silently when the image is unusable", async () => {
    mocks.generateImage.mockRejectedValue(
      new AIResponseError("The model returned no usable image.")
    );

    await expect(processImageGenerationJob(jobFor())).rejects.toBeInstanceOf(AIResponseError);

    expect(mocks.storeGeneratedRecipeImage).not.toHaveBeenCalled();
    expect(mocks.publishLifecycle.mock.calls.map(([, state]) => state)).toEqual(["processing"]);
  });

  it("raises a refusal as unrecoverable so no attempts are burned", async () => {
    mocks.generateImage.mockRejectedValue(
      new AIProviderError("content policy refusal", { retryable: false })
    );

    await expect(processImageGenerationJob(jobFor())).rejects.toBeInstanceOf(UnrecoverableError);
  });

  it("lets a timeout retry through the queue's own attempts", async () => {
    const timeout = new AIProviderError("The AI request timed out.", { retryable: true });

    mocks.generateImage.mockRejectedValue(timeout);

    await expect(processImageGenerationJob(jobFor())).rejects.toBe(timeout);
  });

  it("stops before the image request when the brief is unusable", async () => {
    mocks.writeVisualBrief.mockRejectedValue(
      new AIResponseError("The model returned an empty visual brief.")
    );

    await expect(processImageGenerationJob(jobFor())).rejects.toBeInstanceOf(AIResponseError);
    expect(mocks.generateImage).not.toHaveBeenCalled();
  });
});
