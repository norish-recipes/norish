import type { Queue } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { RecipeEnrichmentJobData } from "@norish/queue/contracts/job-types";

vi.mock("@norish/shared-server/logger", () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

const mocks = vi.hoisted(() => ({ publishLifecycle: vi.fn() }));

vi.mock("../../src/enrichment/announce", () => ({
  publishEnrichmentLifecycle: mocks.publishLifecycle,
}));

const { addEnrichmentJob } = await import("../../src/enrichment/producer");
const { ENRICHMENT_JOB_NAMES, ENRICHMENT_QUEUE_NAMES, enrichmentJobId } =
  await import("../../src/enrichment/identity");

const add = vi.fn();
const getJob = vi.fn();
const remove = vi.fn();
const incr = vi.fn();
const toKey = vi.fn((suffix: string) => `norish:${suffix}`);

const queue = {
  add,
  getJob,
  client: Promise.resolve({ incr }),
  toKey,
} as unknown as Queue<RecipeEnrichmentJobData>;

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
  mocks.publishLifecycle.mockResolvedValue(undefined);
  incr.mockResolvedValue(1);
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

  it("gives every kind its own queue and job name, so none can disturb another", () => {
    const queues = Object.values(ENRICHMENT_QUEUE_NAMES);
    const jobNames = Object.values(ENRICHMENT_JOB_NAMES);

    expect(new Set(queues).size).toBe(queues.length);
    expect(new Set(jobNames).size).toBe(jobNames.length);
    expect(ENRICHMENT_QUEUE_NAMES["recipe-provenance"]).toBe("recipe-provenance");
  });

  it("keys provenance by recipe and kind only, with no locale or field in the id", () => {
    // Duplicate coalescing across server instances depends on this invariant.
    expect(enrichmentJobId("recipe-provenance", "recipe-1")).toBe(
      "enrich_recipe-provenance_recipe-1"
    );
    expect(enrichmentJobId("recipe-provenance", "recipe-1")).not.toBe(
      enrichmentJobId("recipe-provenance", "recipe-2")
    );
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
    expect(add).toHaveBeenCalledWith(
      "auto-tag",
      { ...job(), runId: expect.any(String), runSequence: 1 },
      { jobId: "enrich_auto-tagging_recipe-1" }
    );
  });

  it("announces queued after BullMQ accepts without making publication part of enrollment", async () => {
    const data = job({ origin: "manual", requestedByUserId: "user-1" });

    await expect(addEnrichmentJob(queue, data)).resolves.toMatchObject({ status: "queued" });

    const enrolledData = add.mock.calls[0]?.[1];

    expect(enrolledData).toEqual({ ...data, runId: expect.any(String), runSequence: 1 });
    expect(mocks.publishLifecycle).toHaveBeenCalledWith(enrolledData, "queued");
    expect(add.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.publishLifecycle.mock.invocationCallOrder[0]!
    );
  });

  it("keeps accepted enrollment successful when queued publication fails", async () => {
    mocks.publishLifecycle.mockRejectedValueOnce(new Error("realtime unavailable"));

    await expect(addEnrichmentJob(queue, job())).resolves.toMatchObject({ status: "queued" });
  });

  it("reports a concurrent deterministic-id winner as duplicate and emits no phantom run", async () => {
    getJob
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ data: { ...job(), runId: "winning-run", runSequence: 2 } });

    const result = await addEnrichmentJob(queue, job({ origin: "manual" }));

    expect(result).toEqual({
      kind: "auto-tagging",
      status: "duplicate",
      existingJobId: "enrich_auto-tagging_recipe-1",
    });
    expect(mocks.publishLifecycle).not.toHaveBeenCalled();
  });

  it("allocates a monotonic sequence from Redis for each attempted run", async () => {
    incr.mockResolvedValueOnce(42);

    await addEnrichmentJob(queue, job());

    expect(toKey).toHaveBeenCalledWith("enrichment-run-sequence");
    expect(incr).toHaveBeenCalledWith("norish:enrichment-run-sequence");
    expect(add).toHaveBeenCalledWith(
      "auto-tag",
      expect.objectContaining({ runSequence: 42 }),
      expect.anything()
    );
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

    const result = await addEnrichmentJob(queue, job({ origin: "automatic" }));

    expect(result).toEqual({
      kind: "auto-tagging",
      status: "duplicate",
      existingJobId: "enrich_auto-tagging_recipe-1",
    });
    expect(remove).not.toHaveBeenCalled();
    expect(add).not.toHaveBeenCalled();
    expect(mocks.publishLifecycle).not.toHaveBeenCalled();
  });

  it("does not report a rerun when a retained job cannot be removed", async () => {
    getJob.mockResolvedValue(retained("failed"));
    remove.mockRejectedValue(new Error("locked"));

    await expect(addEnrichmentJob(queue, job({ origin: "manual" }))).rejects.toThrow(
      "Could not replace retained enrichment job"
    );
    expect(add).not.toHaveBeenCalled();
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
