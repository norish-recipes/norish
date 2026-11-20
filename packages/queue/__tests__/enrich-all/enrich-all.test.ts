// @vitest-environment node
/**
 * Enrich All runs in the worker: queueing it returns before the sweep starts, a second ask
 * while one waits or runs is deduplicated onto it, and the job runs the sweep it was asked for.
 */
import type { Job } from "bullmq";
import { describe, expect, it, vi } from "vitest";

import type { EnrichAllJobData } from "@norish/queue/contracts/job-types";

const queue = vi.hoisted(() => ({ add: vi.fn(async () => ({ id: "job-1" })) }));
const enroll = vi.hoisted(() => vi.fn());

vi.mock("@norish/queue/registry", () => ({ getQueues: () => ({ enrichAll: queue }) }));
vi.mock("@norish/queue/enrichment/bulk", () => ({ enrollEnrichmentForAllRecipes: enroll }));
vi.mock("@norish/queue/job-steps", () => ({ reportStep: vi.fn(), completeStep: vi.fn() }));
vi.mock("@norish/queue/create-worker", () => ({ createWorker: vi.fn() }));

const { addEnrichAllJob, ENRICH_ALL_DEDUPLICATION_ID } =
  await import("@norish/queue/enrich-all/producer");
const { processEnrichAllJob } = await import("@norish/queue/enrich-all/worker");

const data: EnrichAllJobData = { userId: "admin-1", householdKey: "hh-1", replaceExisting: true };

describe("Enrich All", () => {
  it("queues one deduplicated job and does not run the sweep", async () => {
    enroll.mockReturnValue(new Promise(() => {}));

    await addEnrichAllJob(data);

    expect(queue.add).toHaveBeenCalledWith("enrich-all", data, {
      deduplication: { id: ENRICH_ALL_DEDUPLICATION_ID },
    });
    expect(enroll).not.toHaveBeenCalled();
  });

  it("runs the sweep in the job, with the requester and the overwrite choice", async () => {
    enroll.mockResolvedValue({ recipes: 3, queued: 9 });

    await processEnrichAllJob({ data } as Job<EnrichAllJobData>);

    expect(enroll).toHaveBeenCalledWith(
      { userId: "admin-1", householdKey: "hh-1" },
      { replaceExisting: true }
    );
  });
});
