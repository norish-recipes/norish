// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { QUEUE_NAMES } from "@norish/queue/config";
import { jobQueueProcedures } from "@norish/trpc/routers/admin/job-queue";

import { setConfig } from "../mocks/server-config";
import { isUserServerAdmin } from "../mocks/users";
import { createMockAdminContext, createMockAdminUser, createMockUser } from "./test-utils";

const { registryMock } = vi.hoisted(() => {
  const queues = new Map<string, unknown>();

  return {
    registryMock: {
      queues,
      getQueueByName: vi.fn((name: string) => queues.get(name)),
      getAllQueueEntries: vi.fn(() =>
        Array.from(queues.entries()).map(([name, queue]) => ({ name, queue }))
      ),
    },
  };
});

vi.mock("@norish/queue/registry", () => ({
  getQueueByName: registryMock.getQueueByName,
  getAllQueueEntries: registryMock.getAllQueueEntries,
}));
vi.mock("@norish/db/repositories/server-config", () => import("../mocks/server-config"));
vi.mock("@norish/db/repositories/users", () => import("../mocks/users"));
vi.mock("@norish/shared-server/logger", () => ({
  trpcLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

interface MockJobOverrides {
  [key: string]: unknown;
}

function createMockJob(overrides: MockJobOverrides = {}) {
  return {
    id: "job-1",
    name: "import",
    data: { url: "https://example.com/recipe", recipeId: "r1", userId: "u1" },
    progress: { step: "parsing", updatedAt: 1000 },
    attemptsMade: 1,
    opts: { attempts: 3 },
    timestamp: 1_000,
    delay: 0,
    processedOn: 2_000,
    finishedOn: 3_000,
    failedReason: null,
    stacktrace: [],
    returnvalue: null,
    repeatJobKey: undefined,
    getState: vi.fn().mockResolvedValue("completed"),
    retry: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function createMockQueue(jobs: ReturnType<typeof createMockJob>[] = []) {
  return {
    getJobs: vi.fn().mockResolvedValue(jobs),
    getJob: vi.fn((id: string) => Promise.resolve(jobs.find((job) => job.id === id) ?? null)),
    getJobCounts: vi.fn().mockResolvedValue({
      waiting: 0,
      active: 0,
      delayed: 0,
      completed: 0,
      failed: 0,
      paused: 0,
      prioritized: 0,
    }),
    getJobLogs: vi.fn().mockResolvedValue({ logs: [], count: 0 }),
  };
}

function createCaller(admin = true) {
  const ctx = createMockAdminContext(admin ? createMockAdminUser() : createMockUser());

  return jobQueueProcedures.createCaller({ ...ctx, multiplexer: null } as never);
}

describe("admin job queue procedures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registryMock.queues.clear();
    isUserServerAdmin.mockImplementation((userId: string) =>
      Promise.resolve(userId === createMockAdminUser().id)
    );
  });

  describe("list", () => {
    it("maps jobs to row DTOs without exposing job data", async () => {
      const queue = createMockQueue([createMockJob()]);

      registryMock.queues.set(QUEUE_NAMES.RECIPE_IMPORT, queue);

      const rows = await createCaller().list({ queue: QUEUE_NAMES.RECIPE_IMPORT, limit: 50 });

      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        queue: QUEUE_NAMES.RECIPE_IMPORT,
        id: "job-1",
        state: "completed",
        target: "https://example.com/recipe",
        step: "parsing",
        attemptsMade: 1,
        maxAttempts: 3,
        durationMs: 1_000,
      });
      expect(rows[0]).not.toHaveProperty("data");
      expect(rows[0]).not.toHaveProperty("dataJson");
    });

    it("flags long-running active jobs as hanging", async () => {
      const staleStart = Date.now() - 11 * 60_000; // recipe-import threshold is 10 min
      const job = createMockJob({
        processedOn: staleStart,
        finishedOn: null,
        getState: vi.fn().mockResolvedValue("active"),
      });

      registryMock.queues.set(QUEUE_NAMES.RECIPE_IMPORT, createMockQueue([job]));

      const rows = await createCaller().list({ queue: QUEUE_NAMES.RECIPE_IMPORT, limit: 50 });

      expect(rows[0]?.state).toBe("active");
      expect(rows[0]?.isHanging).toBe(true);
    });

    it("skips getState when filtering by a single state", async () => {
      const job = createMockJob();

      registryMock.queues.set(QUEUE_NAMES.RECIPE_IMPORT, createMockQueue([job]));

      const rows = await createCaller().list({
        queue: QUEUE_NAMES.RECIPE_IMPORT,
        states: ["failed"],
        limit: 50,
      });

      expect(job.getState).not.toHaveBeenCalled();
      expect(rows[0]?.state).toBe("failed");
    });

    it("merges jobs across all queues sorted newest first", async () => {
      registryMock.queues.set(
        QUEUE_NAMES.RECIPE_IMPORT,
        createMockQueue([createMockJob({ id: "old", timestamp: 1_000 })])
      );
      registryMock.queues.set(
        QUEUE_NAMES.AUTO_TAGGING,
        createMockQueue([createMockJob({ id: "new", timestamp: 5_000, data: { recipeId: "r2" } })])
      );

      const rows = await createCaller().list({ limit: 50 });

      expect(rows.map((row) => row.id)).toEqual(["new", "old"]);
      expect(rows[0]?.target).toBe("r2");
    });

    it("computes runAt for delayed jobs from timestamp + delay", async () => {
      const job = createMockJob({
        timestamp: 10_000,
        delay: 3_600_000,
        getState: vi.fn().mockResolvedValue("delayed"),
      });

      registryMock.queues.set(QUEUE_NAMES.SCHEDULED_TASKS, createMockQueue([job]));

      const rows = await createCaller().list({
        queue: QUEUE_NAMES.SCHEDULED_TASKS,
        states: ["delayed"],
        limit: 50,
      });

      expect(rows[0]?.runAt).toBe(10_000 + 3_600_000);
    });

    it("leaves runAt null for non-delayed jobs", async () => {
      const job = createMockJob({ getState: vi.fn().mockResolvedValue("waiting") });

      registryMock.queues.set(QUEUE_NAMES.RECIPE_IMPORT, createMockQueue([job]));

      const rows = await createCaller().list({
        queue: QUEUE_NAMES.RECIPE_IMPORT,
        states: ["waiting"],
        limit: 50,
      });

      expect(rows[0]?.runAt).toBeNull();
    });
  });

  describe("detail", () => {
    it("returns payload/logs with long strings truncated", async () => {
      const bigPayload = "x".repeat(5_000);
      const job = createMockJob({
        data: { files: [{ data: bigPayload }] },
        failedReason: "boom",
        stacktrace: ["Error: boom\n  at worker"],
        getState: vi.fn().mockResolvedValue("failed"),
      });
      const queue = createMockQueue([job]);

      queue.getJobLogs.mockResolvedValue({ logs: ["step one", "step two"], count: 2 });
      registryMock.queues.set(QUEUE_NAMES.IMAGE_IMPORT, queue);

      const detail = await createCaller().detail({
        queue: QUEUE_NAMES.IMAGE_IMPORT,
        jobId: "job-1",
      });

      expect(detail.dataJson).toContain("…[+2952 chars]");
      expect(detail.dataJson).not.toContain(bigPayload);
      // Unmarked logs carry forward to the first attempt.
      expect(detail.attempts[0]?.logs).toEqual(["step one", "step two"]);
      expect(detail.logsTotal).toBe(2);
      expect(detail.failedReason).toBe("boom");
      expect(detail.attempts[0]?.stack).toContain("Error: boom");
    });

    it("groups worker logs under their attempt", async () => {
      const job = createMockJob({
        attemptsMade: 2,
        getState: vi.fn().mockResolvedValue("failed"),
        stacktrace: [
          "Error: first\n  at worker",
          "Error: second\n  at worker",
        ],
        progress: {
          step: "parsing",
          updatedAt: 3_000,
          attempts: [
            { attempt: 1, timeline: [{ id: "parsing", startedAt: 1_000 }] },
            { attempt: 2, timeline: [{ id: "parsing", startedAt: 2_000 }] },
          ],
        },
      });
      const queue = createMockQueue([job]);

      queue.getJobLogs.mockResolvedValue({
        logs: [
          "2026 [attempt 1] dedupe-check",
          "2026 [attempt 1] parsing",
          "2026 [attempt 2] dedupe-check",
          "2026 [attempt 2] parsing",
        ],
        count: 4,
      });
      registryMock.queues.set(QUEUE_NAMES.RECIPE_IMPORT, queue);

      const detail = await createCaller().detail({
        queue: QUEUE_NAMES.RECIPE_IMPORT,
        jobId: "job-1",
      });

      expect(detail.attempts[0]?.logs).toEqual(["2026 dedupe-check", "2026 parsing"]);
      expect(detail.attempts[1]?.logs).toEqual(["2026 dedupe-check", "2026 parsing"]);
    });

    it("derives pipeline steps per attempt from the progress timelines", async () => {
      const job = createMockJob({
        attemptsMade: 2,
        getState: vi.fn().mockResolvedValue("active"),
        finishedOn: null,
        processedOn: 10_000,
        stacktrace: ["Error: Cannot fetch recipe page.\n  at worker"],
        progress: {
          step: "parsing",
          updatedAt: 11_000,
          attempts: [
            {
              attempt: 1,
              timeline: [
                {
                  id: "dedupe-check",
                  startedAt: 1_000,
                  endedAt: 1_005,
                  detail: { alreadyExists: false },
                },
                { id: "parsing", startedAt: 1_005, endedAt: 2_000 },
              ],
            },
            {
              attempt: 2,
              timeline: [{ id: "dedupe-check", startedAt: 10_000 }],
            },
          ],
        },
      });

      registryMock.queues.set(QUEUE_NAMES.RECIPE_IMPORT, createMockQueue([job]));

      const detail = await createCaller().detail({
        queue: QUEUE_NAMES.RECIPE_IMPORT,
        jobId: "job-1",
      });

      expect(detail.attempts).toHaveLength(2);

      // Attempt 1 failed at "parsing" (its stack aligns from the newest end).
      const first = detail.attempts[0]!;

      expect(first.attempt).toBe(1);
      expect(first.message).toBe("Error: Cannot fetch recipe page.");
      expect(first.steps.map((s) => [s.id, s.status])).toEqual([
        ["dedupe-check", "done"],
        ["parsing", "failed"],
        ["fetch-allergies", "skipped"],
        ["saving", "skipped"],
        ["post-processing", "skipped"],
      ]);
      expect(first.steps[1]?.error).toBe("Error: Cannot fetch recipe page.");

      // Attempt 2 is the current running attempt: remaining steps pending.
      const second = detail.attempts[1]!;

      expect(second.attempt).toBe(2);
      expect(second.message).toBeNull();
      expect(second.steps.map((s) => [s.id, s.status])).toEqual([
        ["dedupe-check", "running"],
        ["fetch-allergies", "pending"],
        ["parsing", "pending"],
        ["saving", "pending"],
        ["post-processing", "pending"],
      ]);
    });

    it("normalizes the legacy flat timeline into a single attempt", async () => {
      const job = createMockJob({
        getState: vi.fn().mockResolvedValue("active"),
        finishedOn: null,
        processedOn: Date.now() - 1_000,
        // legacy flat progress shape (pre per-attempt tracking)
        progress: {
          step: "ai-request",
          updatedAt: Date.now(),
          attempt: 0,
          timeline: [{ id: "ai-request", startedAt: Date.now() - 1_000 }],
        },
      });

      registryMock.queues.set(QUEUE_NAMES.AUTO_TAGGING, createMockQueue([job]));

      const detail = await createCaller().detail({
        queue: QUEUE_NAMES.AUTO_TAGGING,
        jobId: "job-1",
      });

      expect(detail.attempts).toHaveLength(1);
      expect(detail.attempts[0]?.steps.map((step) => [step.id, step.status])).toEqual([
        ["ai-request", "running"],
        ["saving", "pending"],
      ]);
    });

    it("throws NOT_FOUND for a missing job", async () => {
      registryMock.queues.set(QUEUE_NAMES.RECIPE_IMPORT, createMockQueue([]));

      await expect(
        createCaller().detail({ queue: QUEUE_NAMES.RECIPE_IMPORT, jobId: "nope" })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
  });

  describe("retry", () => {
    it("retries a failed job", async () => {
      const job = createMockJob({ getState: vi.fn().mockResolvedValue("failed") });

      registryMock.queues.set(QUEUE_NAMES.RECIPE_IMPORT, createMockQueue([job]));

      const result = await createCaller().retry({
        queue: QUEUE_NAMES.RECIPE_IMPORT,
        jobId: "job-1",
      });

      expect(job.retry).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it("rejects retrying a non-failed job", async () => {
      const job = createMockJob({ getState: vi.fn().mockResolvedValue("completed") });

      registryMock.queues.set(QUEUE_NAMES.RECIPE_IMPORT, createMockQueue([job]));

      await expect(
        createCaller().retry({ queue: QUEUE_NAMES.RECIPE_IMPORT, jobId: "job-1" })
      ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
      expect(job.retry).not.toHaveBeenCalled();
    });
  });

  describe("remove", () => {
    it("removes a finished job", async () => {
      const job = createMockJob();

      registryMock.queues.set(QUEUE_NAMES.RECIPE_IMPORT, createMockQueue([job]));

      const result = await createCaller().remove({
        queue: QUEUE_NAMES.RECIPE_IMPORT,
        jobId: "job-1",
      });

      expect(job.remove).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it("rejects removing repeat jobs", async () => {
      const job = createMockJob({ repeatJobKey: "cron-key" });

      registryMock.queues.set(QUEUE_NAMES.SCHEDULED_TASKS, createMockQueue([job]));

      await expect(
        createCaller().remove({ queue: QUEUE_NAMES.SCHEDULED_TASKS, jobId: "job-1" })
      ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
      expect(job.remove).not.toHaveBeenCalled();
    });

    it("rejects removing active jobs", async () => {
      const job = createMockJob({ getState: vi.fn().mockResolvedValue("active") });

      registryMock.queues.set(QUEUE_NAMES.RECIPE_IMPORT, createMockQueue([job]));

      await expect(
        createCaller().remove({ queue: QUEUE_NAMES.RECIPE_IMPORT, jobId: "job-1" })
      ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
      expect(job.remove).not.toHaveBeenCalled();
    });
  });

  describe("summary", () => {
    it("returns counts and hanging count per queue", async () => {
      const hangingJob = createMockJob({
        processedOn: Date.now() - 11 * 60_000,
        finishedOn: null,
      });
      const queue = createMockQueue([hangingJob]);

      queue.getJobCounts.mockResolvedValue({
        waiting: 2,
        active: 1,
        delayed: 0,
        completed: 5,
        failed: 3,
        paused: 0,
        prioritized: 0,
      });
      registryMock.queues.set(QUEUE_NAMES.RECIPE_IMPORT, queue);

      const summaries = await createCaller().summary();

      expect(summaries).toHaveLength(1);
      expect(summaries[0]).toMatchObject({
        queue: QUEUE_NAMES.RECIPE_IMPORT,
        counts: { waiting: 2, active: 1, failed: 3 },
        hangingCount: 1,
      });
    });
  });

  describe("updateRetention", () => {
    it("persists the retention config", async () => {
      const caller = createCaller();
      const retention = { keepCompleted: 200, keepFailed: 50, maxAgeDays: 14 };

      const result = await caller.updateRetention(retention);

      expect(setConfig).toHaveBeenCalledWith(
        "job_retention",
        retention,
        createMockAdminUser().id,
        false
      );
      expect(result).toEqual({ success: true });
    });

    it("rejects out-of-range retention values", async () => {
      await expect(
        createCaller().updateRetention({ keepCompleted: 5, keepFailed: 50, maxAgeDays: 14 })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });
  });

  describe("authorization", () => {
    it("rejects non-admin users with FORBIDDEN", async () => {
      registryMock.queues.set(QUEUE_NAMES.RECIPE_IMPORT, createMockQueue([]));

      await expect(createCaller(false).list({ limit: 50 })).rejects.toMatchObject({
        code: "FORBIDDEN",
      });
    });
  });
});
