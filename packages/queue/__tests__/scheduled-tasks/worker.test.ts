// @vitest-environment node
/**
 * The scheduled tasks worker is built by hand, not through the lazy worker
 * manager, so it must wrap its processor itself: what a task records on the
 * model-use ledger reaches the job monitor the way a lazy worker's does.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  registerQueueApiHandlers,
  resetQueueApiHandlersForTests,
} from "@norish/queue/api-handlers";
import { readStepProgress } from "@norish/queue/job-steps";
import {
  startScheduledTasksWorker,
  stopScheduledTasksWorker,
} from "@norish/queue/scheduled-tasks/worker";
import { recordModelUse } from "@norish/shared-server/ai/runtime/model-use-ledger";

const scheduler = vi.hoisted(() => ({ checkRecurringGroceries: vi.fn() }));
const captured = vi.hoisted(() => ({
  processor: undefined as ((job: unknown) => Promise<unknown>) | undefined,
}));

vi.mock("bullmq", async (importOriginal) => {
  const actual = await importOriginal<typeof import("bullmq")>();

  class MockWorker {
    on = vi.fn();
    close = vi.fn(async () => undefined);
    removeAllListeners = vi.fn();

    constructor(_queueName: string, processor: (job: unknown) => Promise<unknown>) {
      captured.processor = processor;
    }
  }

  return { ...actual, Worker: MockWorker };
});
vi.mock("@norish/queue/redis/bullmq", () => ({ getBullClient: vi.fn() }));
vi.mock("@norish/queue/scheduler/recurring-grocery-check", () => scheduler);
vi.mock("@norish/queue/scheduler/old-calendar-cleanup", () => ({
  cleanupOldCalendarData: vi.fn(),
}));
vi.mock("@norish/queue/scheduler/old-groceries-cleanup", () => ({ cleanupOldGroceries: vi.fn() }));
vi.mock("@norish/shared-server/logger", () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

describe("startScheduledTasksWorker", () => {
  beforeEach(() => {
    captured.processor = undefined;
    resetQueueApiHandlersForTests();
    registerQueueApiHandlers({
      cleanupOrphanedImages: vi.fn(),
      cleanupOrphanedAvatars: vi.fn(),
      cleanupOrphanedStepImages: vi.fn(),
      cleanupOldTempFiles: vi.fn(),
    });
    startScheduledTasksWorker();
  });

  afterEach(async () => {
    await stopScheduledTasksWorker();
  });

  it("hands BullMQ a processor that writes the models a task asked onto the job", async () => {
    scheduler.checkRecurringGroceries.mockImplementation(async () => {
      recordModelUse({ provider: "openai", model: "gpt-5", outcome: "completed" });

      return { unchecked: 0 };
    });
    const job = {
      id: "job-1",
      attemptsMade: 0,
      data: { taskType: "recurring-grocery-check" },
      progress: {} as unknown,
      updateProgress: vi.fn(async (progress: unknown) => {
        job.progress = progress;
      }),
      log: vi.fn(async () => 0),
    };

    await captured.processor!(job);

    expect(readStepProgress(job.progress)?.attempts[0]?.models).toEqual([
      { provider: "openai", model: "gpt-5", outcome: "completed" },
    ]);
  });
});
