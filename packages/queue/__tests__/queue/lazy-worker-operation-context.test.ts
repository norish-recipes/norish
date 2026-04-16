// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { generateOperationId } from "@norish/shared/lib/operation-helpers";

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

describe("createLazyWorker operation context", () => {
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

  it("restores operationId before invoking the lazy worker processor", async () => {
    const { getCurrentOperationId } = await import("@norish/shared-server/lib/operation-context");
    const { createLazyWorker } = await import("@norish/queue/lazy-worker-manager");

    const opId = generateOperationId();
    let seenOperationId: string | undefined;

    await createLazyWorker(
      "test-lazy-queue",
      async () => {
        seenOperationId = getCurrentOperationId();
      },
      { connection: {} as never }
    );

    expect(capturedProcessor).toBeTypeOf("function");

    await capturedProcessor!({
      data: { recipeId: "r-1", __operationId: opId },
    });

    expect(seenOperationId).toBe(opId);
  });
});
