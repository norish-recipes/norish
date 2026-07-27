/**
 * Recipe AI Edit Queue Tests
 *
 * Tests for the BullMQ recipe AI edit queue factory and producer
 * (duplicate detection + job-id generation).
 */

// @vitest-environment node

import type { Queue } from "bullmq";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RecipeAiEditJobData } from "@norish/queue/contracts/job-types";

// Mock BullMQ
const mockAdd = vi.fn();
const mockGetJob = vi.fn();
const mockClose = vi.fn();
const mockRemove = vi.fn();

vi.mock("bullmq", () => {
  return {
    Queue: class MockQueue {
      add = mockAdd;
      getJob = mockGetJob;
      close = mockClose;
      remove = mockRemove;
    },
    Worker: class MockWorker {
      on = vi.fn();
      close = vi.fn();
    },
    Job: class MockJob {},
  };
});

// Mock server config
vi.mock("@norish/config/env-config-server", () => ({
  SERVER_CONFIG: {
    MASTER_KEY: "QmFzZTY0RW5jb2RlZE1hc3RlcktleU1pbjMyQ2hhcnM=",
    REDIS_URL: "redis://localhost:6379",
    UPLOADS_DIR: "/tmp/uploads",
  },
}));

// Mock queue config
vi.mock("@norish/queue/config", () => ({
  redisConnection: { host: "localhost", port: 6379, password: undefined },
  recipeAiEditJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 3000 },
    removeOnComplete: { age: 3600, count: 500 },
    removeOnFail: { age: 604_800, count: 100 },
  },
  QUEUE_NAMES: {
    RECIPE_AI_EDIT: "recipe-ai-edit",
  },
}));

// Mock Redis client
vi.mock("@norish/queue/redis/bullmq", () => ({
  getBullClient: vi.fn(() => ({ duplicate: vi.fn() })),
}));

// Mock logger
vi.mock("@norish/shared-server/logger", () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

// Mock helpers
vi.mock("@norish/queue/helpers", () => ({
  isJobInQueue: vi.fn(),
}));

describe("Recipe AI Edit Queue", () => {
  let mockQueue: Queue<RecipeAiEditJobData>;

  const mockJobData: RecipeAiEditJobData = {
    recipeId: "recipe-123",
    userId: "user-456",
    householdKey: "household-789",
    instruction: "make it vegan",
    version: 3,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockQueue = {
      add: mockAdd,
      getJob: mockGetJob,
      close: mockClose,
      remove: mockRemove,
    } as unknown as Queue<RecipeAiEditJobData>;
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe("createRecipeAiEditQueue", () => {
    it("creates a queue instance", async () => {
      const { createRecipeAiEditQueue } = await import("@norish/queue/recipe-ai-edit/queue");

      const queue = createRecipeAiEditQueue();

      expect(queue).toBeDefined();
      expect(queue.add).toBeDefined();
      expect(queue.close).toBeDefined();
    });
  });

  describe("addRecipeAiEditJob", () => {
    it("adds a job with a recipe-scoped job id", async () => {
      const { isJobInQueue } = await import("@norish/queue/helpers");

      vi.mocked(isJobInQueue).mockResolvedValue(false);
      mockAdd.mockResolvedValue({ id: "ai-edit-recipe-123" });

      const { addRecipeAiEditJob } = await import("@norish/queue/recipe-ai-edit/producer");

      const result = await addRecipeAiEditJob(mockQueue, mockJobData);

      expect(result.status).toBe("queued");
      // Clears any retained completed/failed job under this id before re-adding
      // (otherwise BullMQ would treat the add as a no-op).
      expect(mockRemove).toHaveBeenCalledWith("ai-edit-recipe-123");
      expect(mockAdd).toHaveBeenCalledWith(
        "ai-edit",
        mockJobData,
        expect.objectContaining({ jobId: "ai-edit-recipe-123" })
      );
    });

    it("returns duplicate when a job already exists for the recipe", async () => {
      const { isJobInQueue } = await import("@norish/queue/helpers");

      vi.mocked(isJobInQueue).mockResolvedValue(true);

      const { addRecipeAiEditJob } = await import("@norish/queue/recipe-ai-edit/producer");

      const result = await addRecipeAiEditJob(mockQueue, mockJobData);

      expect(result.status).toBe("duplicate");
      if (result.status === "duplicate") {
        expect(result.existingJobId).toBe("ai-edit-recipe-123");
      }
      expect(mockAdd).not.toHaveBeenCalled();
    });
  });

  describe("isRecipeAiEditJobActive", () => {
    it("returns true when a job is in the queue", async () => {
      const { isJobInQueue } = await import("@norish/queue/helpers");

      vi.mocked(isJobInQueue).mockResolvedValue(true);

      const { isRecipeAiEditJobActive } = await import("@norish/queue/recipe-ai-edit/producer");

      const result = await isRecipeAiEditJobActive(mockQueue, "recipe-123");

      expect(result).toBe(true);
      expect(isJobInQueue).toHaveBeenCalledWith(mockQueue, "ai-edit-recipe-123");
    });

    it("returns false when no job is in the queue", async () => {
      const { isJobInQueue } = await import("@norish/queue/helpers");

      vi.mocked(isJobInQueue).mockResolvedValue(false);

      const { isRecipeAiEditJobActive } = await import("@norish/queue/recipe-ai-edit/producer");

      const result = await isRecipeAiEditJobActive(mockQueue, "recipe-456");

      expect(result).toBe(false);
    });
  });

  describe("queue lifecycle", () => {
    it("queue can be closed via close method", async () => {
      const { createRecipeAiEditQueue } = await import("@norish/queue/recipe-ai-edit/queue");

      const queue = createRecipeAiEditQueue();

      await queue.close();

      expect(mockClose).toHaveBeenCalled();
    });
  });
});
