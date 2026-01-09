/**
 * Auto-Tagging Queue Tests
 *
 * Tests for BullMQ auto-tagging queue with disabled mode handling.
 * Updated for new DI architecture: queue factory + producer pattern.
 */

// @vitest-environment node

import type { Queue } from "bullmq";
import type { AutoTaggingJobData } from "@/types";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock BullMQ
const mockAdd = vi.fn();
const mockGetJob = vi.fn();
const mockClose = vi.fn();

vi.mock("bullmq", () => {
  return {
    Queue: class MockQueue {
      add = mockAdd;
      getJob = mockGetJob;
      close = mockClose;
    },
    Worker: class MockWorker {
      on = vi.fn();
      close = vi.fn();
    },
    Job: class MockJob {},
  };
});

// Mock config loader
vi.mock("@/config/server-config-loader", () => ({
  getAutoTaggingMode: vi.fn(),
}));

// Mock server config
vi.mock("@/config/env-config-server", () => ({
  SERVER_CONFIG: {
    MASTER_KEY: "QmFzZTY0RW5jb2RlZE1hc3RlcktleU1pbjMyQ2hhcnM=",
    REDIS_URL: "redis://localhost:6379",
    UPLOADS_DIR: "/tmp/uploads",
  },
}));

// Mock queue config
vi.mock("@/server/queue/config", () => ({
  redisConnection: {
    host: "localhost",
    port: 6379,
    password: undefined,
  },
  autoTaggingJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: true,
    removeOnFail: true,
  },
  QUEUE_NAMES: {
    AUTO_TAGGING: "auto-tagging",
  },
}));

// Mock Redis client
vi.mock("@/server/redis/bullmq", () => ({
  getBullClient: vi.fn(() => ({
    duplicate: vi.fn(),
  })),
}));

// Mock logger
vi.mock("@/server/logger", () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

// Mock helpers
vi.mock("@/server/queue/helpers", () => ({
  isJobInQueue: vi.fn(),
}));

import { getAutoTaggingMode } from "@/config/server-config-loader";

describe("Auto-Tagging Queue", () => {
  let mockQueue: Queue<AutoTaggingJobData>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Create a mock queue instance for producer tests
    mockQueue = {
      add: mockAdd,
      getJob: mockGetJob,
      close: mockClose,
    } as unknown as Queue<AutoTaggingJobData>;
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe("createAutoTaggingQueue", () => {
    it("creates a queue instance", async () => {
      const { createAutoTaggingQueue } = await import("@/server/queue/auto-tagging/queue");

      const queue = createAutoTaggingQueue();

      expect(queue).toBeDefined();
      expect(queue.add).toBeDefined();
      expect(queue.close).toBeDefined();
    });
  });

  describe("addAutoTaggingJob", () => {
    const mockJobData = {
      recipeId: "recipe-123",
      userId: "user-456",
      householdKey: "household-789",
    };

    it("skips job when auto-tagging is disabled", async () => {
      vi.mocked(getAutoTaggingMode).mockResolvedValue("disabled");

      const { addAutoTaggingJob } = await import("@/server/queue/auto-tagging/producer");

      const result = await addAutoTaggingJob(mockQueue, mockJobData);

      expect(result.status).toBe("skipped");
      if (result.status === "skipped") {
        expect(result.reason).toBe("disabled");
      }
      expect(mockAdd).not.toHaveBeenCalled();
    });

    it("adds job successfully when auto-tagging is enabled (predefined mode)", async () => {
      vi.mocked(getAutoTaggingMode).mockResolvedValue("predefined");
      const { isJobInQueue } = await import("@/server/queue/helpers");

      vi.mocked(isJobInQueue).mockResolvedValue(false);
      mockAdd.mockResolvedValue({ id: "auto-tag-recipe-123" });

      const { addAutoTaggingJob } = await import("@/server/queue/auto-tagging/producer");

      const result = await addAutoTaggingJob(mockQueue, mockJobData);

      expect(result.status).toBe("queued");
      expect(mockAdd).toHaveBeenCalledWith(
        "auto-tag",
        mockJobData,
        expect.objectContaining({
          jobId: "auto-tag-recipe-123",
        })
      );
    });

    it("adds job successfully when auto-tagging is in predefined_db mode", async () => {
      vi.mocked(getAutoTaggingMode).mockResolvedValue("predefined_db");
      const { isJobInQueue } = await import("@/server/queue/helpers");

      vi.mocked(isJobInQueue).mockResolvedValue(false);
      mockAdd.mockResolvedValue({ id: "auto-tag-recipe-123" });

      const { addAutoTaggingJob } = await import("@/server/queue/auto-tagging/producer");

      const result = await addAutoTaggingJob(mockQueue, mockJobData);

      expect(result.status).toBe("queued");
    });

    it("adds job successfully when auto-tagging is in freeform mode", async () => {
      vi.mocked(getAutoTaggingMode).mockResolvedValue("freeform");
      const { isJobInQueue } = await import("@/server/queue/helpers");

      vi.mocked(isJobInQueue).mockResolvedValue(false);
      mockAdd.mockResolvedValue({ id: "auto-tag-recipe-123" });

      const { addAutoTaggingJob } = await import("@/server/queue/auto-tagging/producer");

      const result = await addAutoTaggingJob(mockQueue, mockJobData);

      expect(result.status).toBe("queued");
    });

    it("returns duplicate when job already exists in queue", async () => {
      vi.mocked(getAutoTaggingMode).mockResolvedValue("predefined");
      const { isJobInQueue } = await import("@/server/queue/helpers");

      vi.mocked(isJobInQueue).mockResolvedValue(true);

      const { addAutoTaggingJob } = await import("@/server/queue/auto-tagging/producer");

      const result = await addAutoTaggingJob(mockQueue, mockJobData);

      expect(result.status).toBe("duplicate");
      if (result.status === "duplicate") {
        expect(result.existingJobId).toBe("auto-tag-recipe-123");
      }
      expect(mockAdd).not.toHaveBeenCalled();
    });

    it("uses recipe ID to generate unique job ID", async () => {
      vi.mocked(getAutoTaggingMode).mockResolvedValue("predefined");
      const { isJobInQueue } = await import("@/server/queue/helpers");

      vi.mocked(isJobInQueue).mockResolvedValue(false);
      mockAdd.mockResolvedValue({ id: "auto-tag-unique-recipe-id" });

      const { addAutoTaggingJob } = await import("@/server/queue/auto-tagging/producer");

      await addAutoTaggingJob(mockQueue, {
        recipeId: "unique-recipe-id",
        userId: "user-1",
        householdKey: "household-1",
      });

      expect(mockAdd).toHaveBeenCalledWith(
        "auto-tag",
        expect.any(Object),
        expect.objectContaining({
          jobId: "auto-tag-unique-recipe-id",
        })
      );
    });
  });

  describe("isAutoTaggingJobActive", () => {
    it("returns true when job is in queue", async () => {
      const { isJobInQueue } = await import("@/server/queue/helpers");

      vi.mocked(isJobInQueue).mockResolvedValue(true);

      const { isAutoTaggingJobActive } = await import("@/server/queue/auto-tagging/producer");

      const result = await isAutoTaggingJobActive(mockQueue, "recipe-123");

      expect(result).toBe(true);
      expect(isJobInQueue).toHaveBeenCalledWith(mockQueue, "auto-tag-recipe-123");
    });

    it("returns false when job is not in queue", async () => {
      const { isJobInQueue } = await import("@/server/queue/helpers");

      vi.mocked(isJobInQueue).mockResolvedValue(false);

      const { isAutoTaggingJobActive } = await import("@/server/queue/auto-tagging/producer");

      const result = await isAutoTaggingJobActive(mockQueue, "recipe-456");

      expect(result).toBe(false);
    });
  });

  describe("queue lifecycle (registry)", () => {
    it("queue can be closed via close method", async () => {
      const { createAutoTaggingQueue } = await import("@/server/queue/auto-tagging/queue");

      const queue = createAutoTaggingQueue();

      await queue.close();

      expect(mockClose).toHaveBeenCalled();
    });
  });
});
