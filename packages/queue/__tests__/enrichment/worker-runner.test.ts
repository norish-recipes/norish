import type { Job } from "bullmq";
import { UnrecoverableError } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RecipeEnrichmentJobData } from "@norish/queue/contracts/job-types";
import { AIDisabledError, AIProviderError } from "@norish/shared-server/ai/runtime/errors";

const mocks = vi.hoisted(() => ({
  getRecipeFull: vi.fn(),
  publishLifecycle: vi.fn(),
  publishRecipeUpdated: vi.fn(),
  reportStep: vi.fn(),
}));

vi.mock("@norish/db", () => ({ getRecipeFull: mocks.getRecipeFull }));
vi.mock("@norish/shared-server/logger", () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));
vi.mock("../../src/enrichment/announce", () => ({
  publishEnrichmentLifecycle: mocks.publishLifecycle,
  publishEnrichmentRecipeUpdated: mocks.publishRecipeUpdated,
}));
vi.mock("../../src/job-steps", () => ({ reportStep: mocks.reportStep }));

const { handleEnrichmentJobFailure, runEnrichmentJob } =
  await import("../../src/enrichment/worker-runner");

const data: RecipeEnrichmentJobData = {
  recipeId: "recipe-1",
  kind: "auto-tagging",
  userId: "user-1",
  householdKey: "household-1",
  householdUserIds: ["user-1"],
  origin: "automatic",
};

describe("runEnrichmentJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRecipeFull.mockResolvedValue({ id: "recipe-1" });
  });

  it("publishes processing before the terminal worker transition", async () => {
    const job = { id: "job-1", data, attemptsMade: 0 } as Job<RecipeEnrichmentJobData>;

    await runEnrichmentJob(job, vi.fn().mockResolvedValue(false));

    expect(mocks.publishLifecycle.mock.calls).toEqual([
      [data, "processing"],
      [data, "succeeded"],
    ]);
  });

  it("stops retrying an AI failure that says a retry cannot succeed", async () => {
    // AI having been switched off cannot change between attempts: burning
    // three attempts with backoff on it helps nobody.
    const job = { id: "job-1", data, attemptsMade: 0 } as Job<RecipeEnrichmentJobData>;

    await expect(
      runEnrichmentJob(job, vi.fn().mockRejectedValue(new AIDisabledError()))
    ).rejects.toBeInstanceOf(UnrecoverableError);
  });

  it("keeps a retryable AI failure as an ordinary throw for BullMQ's attempts", async () => {
    const job = { id: "job-1", data, attemptsMade: 0 } as Job<RecipeEnrichmentJobData>;
    const failure = new AIProviderError("provider timed out", { retryable: true });

    const error = await runEnrichmentJob(job, vi.fn().mockRejectedValue(failure)).catch(
      (err: unknown) => err
    );

    expect(error).toBe(failure);
    expect(error).not.toBeInstanceOf(UnrecoverableError);
  });
});

describe("handleEnrichmentJobFailure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("treats an unrecoverable failure as terminal on its first attempt", async () => {
    // BullMQ will not retry it, so waiting for the final attempt would leave
    // the lifecycle stuck in processing forever.
    const job = {
      id: "job-1",
      data,
      attemptsMade: 1,
      opts: { attempts: 3 },
    } as Job<RecipeEnrichmentJobData>;

    await handleEnrichmentJobFailure(job, new UnrecoverableError("AI features are disabled."));

    expect(mocks.publishLifecycle).toHaveBeenCalledWith(data, "failed");
  });

  it("stays quiet on a non-final ordinary failure", async () => {
    const job = {
      id: "job-1",
      data,
      attemptsMade: 1,
      opts: { attempts: 3 },
    } as Job<RecipeEnrichmentJobData>;

    await handleEnrichmentJobFailure(job, new Error("provider timed out"));

    expect(mocks.publishLifecycle).not.toHaveBeenCalled();
  });
});
