import type { Job, Queue } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ScheduledTaskJobData } from "../../src/scheduled-tasks/queue";
import { initializeScheduledJobs } from "../../src/scheduled-tasks/producer";
import { processScheduledTask } from "../../src/scheduled-tasks/worker";

const cleanupExpiredMutationReceipts = vi.hoisted(() => vi.fn());
const requireQueueApiHandler = vi.hoisted(() =>
  vi.fn((name: string) => {
    if (name === "cleanupExpiredMutationReceipts") return cleanupExpiredMutationReceipts;

    throw new Error(`Unexpected queue API handler: ${name}`);
  })
);
const reportStep = vi.hoisted(() => vi.fn());

vi.mock("@norish/queue/api-handlers", () => ({ requireQueueApiHandler }));
vi.mock("../../src/job-steps", () => ({ reportStep }));

describe("scheduled mutation receipt cleanup", () => {
  beforeEach(() => {
    cleanupExpiredMutationReceipts.mockReset();
    cleanupExpiredMutationReceipts.mockResolvedValue(4);
    requireQueueApiHandler.mockClear();
    reportStep.mockReset();
    reportStep.mockResolvedValue(undefined);
  });

  it("registers the cleanup as a daily scheduled task", async () => {
    const queue = {
      getJobSchedulers: vi.fn().mockResolvedValue([]),
      add: vi.fn().mockResolvedValue(undefined),
    } as unknown as Queue<ScheduledTaskJobData>;

    await initializeScheduledJobs(queue);

    expect(queue.add).toHaveBeenCalledWith(
      "mutation-receipts-cleanup",
      { taskType: "mutation-receipts-cleanup" },
      {
        repeat: { pattern: "0 0 * * *" },
        jobId: "mutation-receipts-cleanup",
      }
    );
  });

  it("executes the registered API cleanup handler", async () => {
    const job = {
      id: "receipt-cleanup-job",
      data: { taskType: "mutation-receipts-cleanup" },
    } as Job<ScheduledTaskJobData>;

    await processScheduledTask(job);

    expect(reportStep).toHaveBeenCalledWith(job, "running:mutation-receipts-cleanup");
    expect(requireQueueApiHandler).toHaveBeenCalledWith("cleanupExpiredMutationReceipts");
    expect(cleanupExpiredMutationReceipts).toHaveBeenCalledOnce();
  });
});
