import type { Queue } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RecipeEnrichmentJobData } from "@norish/queue/contracts/job-types";

vi.mock("@norish/shared-server/logger", () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const { addEnrichmentJob } = await import("../../src/enrichment/producer");
const { enrichmentJobId } = await import("../../src/enrichment/identity");

const add = vi.fn();
const getJob = vi.fn();
const remove = vi.fn();

const queue = { add, getJob } as unknown as Queue<RecipeEnrichmentJobData>;

function job(data: Partial<RecipeEnrichmentJobData> = {}): RecipeEnrichmentJobData {
  return {
    recipeId: "recipe-1",
    kind: "auto-tagging",
    userId: "user-1",
    householdKey: "household-1",
    householdUserIds: ["user-1"],
    origin: "automatic",
    ...data,
  };
}

/** A retained job in the given BullMQ state. */
function retained(state: string) {
  return { getState: vi.fn().mockResolvedValue(state), remove };
}

beforeEach(() => {
  vi.clearAllMocks();
  getJob.mockResolvedValue(null);
  add.mockImplementation(async (_name: string, _data: unknown, opts: { jobId: string }) => ({
    id: opts.jobId,
  }));
});

describe("enrichment job identity", () => {
  it("is deterministic per recipe and kind", () => {
    expect(enrichmentJobId("auto-tagging", "recipe-1")).toBe("enrich_auto-tagging_recipe-1");
    expect(enrichmentJobId("auto-tagging", "recipe-1")).toBe(
      enrichmentJobId("auto-tagging", "recipe-1")
    );
    expect(enrichmentJobId("allergy-detection", "recipe-1")).not.toBe(
      enrichmentJobId("auto-tagging", "recipe-1")
    );
  });

  it("contains no colons, which BullMQ rejects in job ids", () => {
    expect(enrichmentJobId("nutrition-estimation", "recipe-1")).not.toContain(":");
  });
});

describe("addEnrichmentJob", () => {
  it("queues under the deterministic id", async () => {
    const result = await addEnrichmentJob(queue, job());

    expect(result).toEqual({
      kind: "auto-tagging",
      status: "queued",
      jobId: "enrich_auto-tagging_recipe-1",
    });
    expect(add).toHaveBeenCalledWith("auto-tag", job(), { jobId: "enrich_auto-tagging_recipe-1" });
  });

  it.each(["waiting", "delayed", "active", "prioritized"])(
    "rejects a duplicate while a %s job holds the recipe and kind",
    async (state) => {
      getJob.mockResolvedValue(retained(state));

      const result = await addEnrichmentJob(queue, job());

      expect(result).toEqual({
        kind: "auto-tagging",
        status: "duplicate",
        existingJobId: "enrich_auto-tagging_recipe-1",
      });
      expect(add).not.toHaveBeenCalled();
    }
  );

  it.each(["completed", "failed"])(
    "lets a manual rerun replace a retained %s job, so history cannot block it",
    async (state) => {
      getJob.mockResolvedValue(retained(state));

      const result = await addEnrichmentJob(queue, job({ origin: "manual" }));

      expect(remove).toHaveBeenCalled();
      expect(result.status).toBe("queued");
    }
  );

  it("does not clear a retained job for automatic enrollment, so duplicates coalesce", async () => {
    getJob.mockResolvedValue(retained("completed"));

    await addEnrichmentJob(queue, job({ origin: "automatic" }));

    // BullMQ treats the re-add as a no-op for an existing id, so a second
    // creation event cannot re-spend AI on a run that already completed.
    expect(remove).not.toHaveBeenCalled();
  });

  it("still queues when a retained job cannot be removed", async () => {
    getJob.mockResolvedValue(retained("failed"));
    remove.mockRejectedValue(new Error("locked"));

    const result = await addEnrichmentJob(queue, job({ origin: "manual" }));

    expect(result.status).toBe("queued");
  });

  it("uses each kind's own queue job name", async () => {
    await addEnrichmentJob(queue, job({ kind: "allergy-detection" }));
    expect(add).toHaveBeenCalledWith("allergy-detect", expect.anything(), expect.anything());

    await addEnrichmentJob(queue, job({ kind: "auto-categorization" }));
    expect(add).toHaveBeenCalledWith("auto-categorize", expect.anything(), expect.anything());

    await addEnrichmentJob(queue, job({ kind: "nutrition-estimation" }));
    expect(add).toHaveBeenCalledWith("estimate", expect.anything(), expect.anything());
  });
});
