// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockWorkerOn = vi.fn();
const mockWorkerRun = vi.fn(async () => undefined);
const mockWorkerClose = vi.fn(async () => undefined);
const mockWorkerPause = vi.fn(async () => undefined);
const mockWorkerResume = vi.fn(async () => undefined);
const mockWorkerIsPaused = vi.fn(() => false);
const mockWorkerRemoveAllListeners = vi.fn();
const mockQueueGetJobCounts = vi.fn(async () => ({ waiting: 0 }));
const mockQueueClose = vi.fn(async () => undefined);
const mockQueueEventsOn = vi.fn();
const mockQueueEventsWaitUntilReady = vi.fn(async () => undefined);
const mockQueueEventsClose = vi.fn(async () => undefined);
const mockQueueEventsRemoveAllListeners = vi.fn();

let capturedProcessor: ((job: unknown, token?: string) => Promise<unknown>) | undefined;

vi.mock("bullmq", async (importOriginal) => {
  const actual = await importOriginal<typeof import("bullmq")>();

  class MockWorker {
    on = mockWorkerOn;
    run = mockWorkerRun;
    close = mockWorkerClose;
    pause = mockWorkerPause;
    resume = mockWorkerResume;
    isPaused = mockWorkerIsPaused;
    removeAllListeners = mockWorkerRemoveAllListeners;

    constructor(_queueName: string, processor: (job: unknown, token?: string) => Promise<unknown>) {
      capturedProcessor = processor;
    }
  }

  class MockQueue {
    getJobCounts = mockQueueGetJobCounts;
    close = mockQueueClose;
  }

  class MockQueueEvents {
    on = mockQueueEventsOn;
    waitUntilReady = mockQueueEventsWaitUntilReady;
    close = mockQueueEventsClose;
    removeAllListeners = mockQueueEventsRemoveAllListeners;
  }

  return {
    ...actual,
    Worker: MockWorker,
    Queue: MockQueue,
    QueueEvents: MockQueueEvents,
  };
});

vi.mock("@norish/api/logger", () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

describe("createLazyWorker model ledger", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedProcessor = undefined;
    mockWorkerIsPaused.mockReturnValue(false);
    mockQueueGetJobCounts.mockResolvedValue({ waiting: 1 });
  });

  afterEach(async () => {
    const { stopAllLazyWorkers } = await import("@norish/queue/lazy-worker-manager");

    await stopAllLazyWorkers();
    vi.resetModules();
  });

  it("writes the models a lazy worker's job asked onto the job", async () => {
    const { recordModelUse } = await import("@norish/shared-server/ai/runtime/model-use-ledger");
    const { readStepProgress } = await import("@norish/queue/job-steps");
    const { createLazyWorker } = await import("@norish/queue/lazy-worker-manager");

    await createLazyWorker(
      "test-lazy-queue",
      async () => {
        recordModelUse({ provider: "typesafe", model: "jev-2026-09-01", outcome: "completed" });
      },
      { connection: {} as never }
    );

    expect(capturedProcessor).toBeTypeOf("function");

    const job = {
      id: "job-1",
      attemptsMade: 0,
      data: { recipeId: "r-1" },
      progress: {} as unknown,
      updateProgress: vi.fn(async (progress: unknown) => {
        job.progress = progress;
      }),
      log: vi.fn(async () => 0),
    };

    await capturedProcessor!(job);

    expect(readStepProgress(job.progress)?.attempts[0]?.models).toEqual([
      { provider: "typesafe", model: "jev-2026-09-01", outcome: "completed" },
    ]);
  });
});
