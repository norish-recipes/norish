// @vitest-environment node
/**
 * Starting the scheduled tasks. What matters here is not the cron pattern but
 * what happens to a task the code used to have: removing its schedule leaves
 * the jobs that schedule already queued behind, and the worker then fails on
 * every one of them until somebody empties the Valkey they sit in.
 */
import type { Job, Queue } from "bullmq";
import { describe, expect, it, vi } from "vitest";

import type { ScheduledTaskJobData } from "@norish/queue/scheduled-tasks/tasks";
import { initializeScheduledJobs } from "@norish/queue/scheduled-tasks/producer";
import { SCHEDULED_TASKS } from "@norish/queue/scheduled-tasks/tasks";

vi.mock("@norish/shared-server/logger", () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

type FakeJob = Job<ScheduledTaskJobData> & { remove: ReturnType<typeof vi.fn> };

function fakeJob(taskType: string): FakeJob {
  return {
    id: `job-${taskType}`,
    data: { taskType },
    remove: vi.fn(async () => Promise.resolve()),
  } as unknown as FakeJob;
}

function fakeQueue(queued: FakeJob[]) {
  return {
    add: vi.fn(async () => Promise.resolve()),
    upsertJobScheduler: vi.fn(async () => Promise.resolve()),
    getJobSchedulers: vi.fn(async () => Promise.resolve([{ key: "old-sweep" }])),
    removeJobScheduler: vi.fn(async () => Promise.resolve()),
    getJobs: vi.fn(async () => Promise.resolve(queued)),
  } as unknown as Queue<ScheduledTaskJobData>;
}

describe("initializeScheduledJobs", () => {
  it("registers every task this build knows, and only those", async () => {
    const queue = fakeQueue([]);

    await initializeScheduledJobs(queue);

    // Job Schedulers: `add` with `repeat` is gone in BullMQ 6, and a task
    // registered that way would run once and never again.
    expect(vi.mocked(queue.upsertJobScheduler).mock.calls).toEqual(
      SCHEDULED_TASKS.map((taskType) => [
        taskType,
        { pattern: "0 0 * * *" },
        { name: taskType, data: { taskType } },
      ])
    );
    expect(SCHEDULED_TASKS).toContain("ingredient-catalogue-refresh");
  });

  it("asks for the ingredient catalogue at once, so a new instance does not wait for midnight", async () => {
    const queue = fakeQueue([]);

    await initializeScheduledJobs(queue);

    expect(vi.mocked(queue.add).mock.calls).toEqual([
      [
        "ingredient-catalogue-refresh",
        { taskType: "ingredient-catalogue-refresh" },
        { deduplication: { id: "boot-ingredient-catalogue-refresh" } },
      ],
    ]);
  });

  it("clears out a task type the code no longer has", async () => {
    const stranded = fakeJob("price-refresh-sweep");
    const kept = fakeJob("media-cleanup");
    const queue = fakeQueue([stranded, kept]);

    await initializeScheduledJobs(queue);

    expect(stranded.remove).toHaveBeenCalled();
    expect(kept.remove).not.toHaveBeenCalled();
  });

  it("takes the old schedule away as well as its leftovers", async () => {
    const queue = fakeQueue([]);

    await initializeScheduledJobs(queue);

    expect(queue.removeJobScheduler).toHaveBeenCalledWith("old-sweep");
  });

  it("carries on when a stranded job cannot be removed", async () => {
    const stubborn = fakeJob("price-refresh-sweep");

    stubborn.remove.mockRejectedValue(new Error("locked"));

    await expect(initializeScheduledJobs(fakeQueue([stubborn]))).resolves.toBeUndefined();
  });
});
