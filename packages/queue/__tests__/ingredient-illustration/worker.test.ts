// @vitest-environment node
/**
 * The Ingredient Illustration worker (ADR-0037): one square image request from
 * the entry's name and its own prompt, one storage operation, and no billed
 * retries on a failure a retry cannot fix.
 */
import type { Job } from "bullmq";
import { UnrecoverableError } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { IngredientIllustrationJobData } from "@norish/queue/contracts/job-types";
import { AIConfigurationError, AIResponseError } from "@norish/shared-server/ai/runtime/errors";

const mocks = vi.hoisted(() => ({
  findIngredientById: vi.fn(),
  generateImage: vi.fn(),
  storeIngredientIllustration: vi.fn(),
  reportStep: vi.fn(),
}));

vi.mock("@norish/db/repositories/ingredients", () => ({
  findIngredientById: mocks.findIngredientById,
}));

vi.mock("@norish/shared-server/ai/runtime/runtime", () => ({
  generateImage: mocks.generateImage,
}));

vi.mock("@norish/shared-server/media/ingredient-illustration", () => ({
  storeIngredientIllustration: mocks.storeIngredientIllustration,
}));

vi.mock("@norish/shared-server/logger", () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

vi.mock("../../src/job-steps", () => ({ reportStep: mocks.reportStep }));

const { processIngredientIllustrationJob } =
  await import("../../src/ingredient-illustration/worker");

const ENTRY = {
  id: "entry-1",
  name: "Red onion",
  imageUrl: null,
  version: 1,
};

function job(): Job<IngredientIllustrationJobData> {
  return {
    id: "illustration|entry-1",
    data: { ingredientId: "entry-1", requestedByUserId: "admin-1" },
  } as Job<IngredientIllustrationJobData>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findIngredientById.mockResolvedValue(ENTRY);
  mocks.generateImage.mockResolvedValue({ bytes: Buffer.from("png"), mediaType: "image/png" });
  mocks.storeIngredientIllustration.mockResolvedValue("/ingredient-images/entry-1-x.webp");
});

describe("processIngredientIllustrationJob", () => {
  it("draws the entry's name square from the illustration prompt and stores it", async () => {
    await processIngredientIllustrationJob(job());

    expect(mocks.generateImage).toHaveBeenCalledWith({
      prompt: "ingredient-illustration-style",
      sections: ["Red onion"],
      shape: "square",
    });
    expect(mocks.storeIngredientIllustration).toHaveBeenCalledWith("entry-1", Buffer.from("png"));
    expect(mocks.reportStep.mock.calls.map(([, step]) => step)).toEqual(["ai-request", "saving"]);
  });

  it("does nothing for an entry deleted after it was queued", async () => {
    mocks.findIngredientById.mockResolvedValue(null);

    await processIngredientIllustrationJob(job());

    expect(mocks.generateImage).not.toHaveBeenCalled();
    expect(mocks.storeIngredientIllustration).not.toHaveBeenCalled();
  });

  it("gives up at once on a failure a retry cannot fix", async () => {
    mocks.generateImage.mockRejectedValue(new AIConfigurationError("No image provider"));

    await expect(processIngredientIllustrationJob(job())).rejects.toBeInstanceOf(
      UnrecoverableError
    );
    expect(mocks.storeIngredientIllustration).not.toHaveBeenCalled();
  });

  it("lets a retryable failure retry", async () => {
    const failure = new AIResponseError("empty image");

    mocks.generateImage.mockRejectedValue(failure);

    await expect(processIngredientIllustrationJob(job())).rejects.toBe(failure);
  });
});
