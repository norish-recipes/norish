import type { Job } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RecipeEnrichmentJobData } from "@norish/queue/contracts/job-types";

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

const { runEnrichmentJob } = await import("../../src/enrichment/worker-runner");

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
});
