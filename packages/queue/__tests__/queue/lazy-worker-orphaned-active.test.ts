// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockWorkerOn = vi.fn();
const mockWorkerRun = vi.fn(async () => undefined);
const mockWorkerClose = vi.fn(async () => undefined);
const mockWorkerPause = vi.fn(async () => undefined);
const mockWorkerResume = vi.fn(async () => undefined);
const mockWorkerIsPaused = vi.fn(() => false);
const mockWorkerRemoveAllListeners = vi.fn();
const mockQueueGetJobCounts = vi.fn(async (): Promise<Record<string, number>> => ({ waiting: 0 }));
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

/**
 * A job left active by a process that died (a restart mid-job) is only
 * recovered by a running worker's stalled-job check, and no 'waiting' event
 * ever comes for it: the manager starts a worker for it on its own.
 */
describe("createLazyWorker with a job left active by a previous process", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedProcessor = undefined;
    mockWorkerIsPaused.mockReturnValue(false);
  });

  afterEach(async () => {
    const { stopAllLazyWorkers } = await import("@norish/queue/lazy-worker-manager");

    await stopAllLazyWorkers();
  });

  it("starts a worker, so the stalled job is picked up again", async () => {
    mockQueueGetJobCounts.mockResolvedValue({ waiting: 0, active: 1 });
    const { createLazyWorker } = await import("@norish/queue/lazy-worker-manager");

    await createLazyWorker("ingredient-review", vi.fn(), { connection: {} as never });

    expect(mockQueueGetJobCounts).toHaveBeenCalledWith("waiting", "active");
    expect(capturedProcessor).toBeDefined();
  });

  it("starts nothing for an empty queue", async () => {
    mockQueueGetJobCounts.mockResolvedValue({ waiting: 0, active: 0 });
    const { createLazyWorker } = await import("@norish/queue/lazy-worker-manager");

    await createLazyWorker("ingredient-review", vi.fn(), { connection: {} as never });

    expect(capturedProcessor).toBeUndefined();
  });
});
