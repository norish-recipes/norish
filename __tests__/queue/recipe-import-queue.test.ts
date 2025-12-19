/**
 * Recipe Import Queue Tests
 *
 * Tests for BullMQ recipe import queue with policy-aware deduplication.
 */

// @vitest-environment node

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
    Job: class MockJob { },
  };
});

// Mock config loader
vi.mock("@/config/server-config-loader", () => ({
  getRecipePermissionPolicy: vi.fn(),
}));

// Mock server config
vi.mock("@/config/env-config-server", () => ({
  SERVER_CONFIG: {
    MASTER_KEY: "QmFzZTY0RW5jb2RlZE1hc3RlcktleU1pbjMyQ2hhcnM=",
    REDIS_URL: "redis://localhost:6379",
    UPLOADS_DIR: "/tmp/uploads",
  },
}));

// Mock queue config to avoid URL parsing issues
vi.mock("@/server/queue/config", () => ({
  redisConnection: {
    host: "localhost",
    port: 6379,
    password: undefined,
  },
  recipeImportJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: true,
    removeOnFail: true,
  },
  caldavSyncJobOptions: {
    attempts: 10,
    backoff: { type: "exponential", delay: 60000 },
    removeOnComplete: true,
    removeOnFail: true,
  },
  scheduledTasksJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: true,
    removeOnFail: true,
  },
  nutritionEstimationJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: true,
    removeOnFail: true,
  },
  QUEUE_NAMES: {
    RECIPE_IMPORT: "recipe-import",
    IMAGE_IMPORT: "image-recipe-import",
    PASTE_IMPORT: "paste-recipe-import",
    CALDAV_SYNC: "caldav-sync",
    SCHEDULED_TASKS: "scheduled-tasks",
    NUTRITION_ESTIMATION: "nutrition-estimation",
  },
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

// Mock DB functions
const mockRecipeExistsByUrlForPolicy = vi.fn();

vi.mock("@/server/db", () => ({
  recipeExistsByUrlForPolicy: mockRecipeExistsByUrlForPolicy,
}));

// eslint-disable-next-line import/order -- Type imports must come after mocks are set up in test files
import type { RecipePermissionPolicy } from "@/server/db/zodSchemas/server-config";

import { getRecipePermissionPolicy } from "@/config/server-config-loader";

describe("Recipe Import Queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no existing recipe in DB
    mockRecipeExistsByUrlForPolicy.mockResolvedValue({ exists: false });
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe("generateJobId", () => {
    it("generates global job ID for 'everyone' policy", async () => {
      const { generateJobId } = await import("@/server/queue");

      const jobId = generateJobId(
        "https://example.com/recipe",
        "user-123",
        "household-456",
        "everyone"
      );

      expect(jobId).toBe("import_example.com_recipe");
      expect(jobId).not.toContain("user-123");
      expect(jobId).not.toContain("household-456");
    }, 15_000);

    it("generates household-scoped job ID for 'household' policy", async () => {
      const { generateJobId } = await import("@/server/queue");

      const jobId = generateJobId(
        "https://example.com/recipe",
        "user-123",
        "household-456",
        "household"
      );

      expect(jobId).toBe("import_household-456_example.com_recipe");
      expect(jobId).toContain("household-456");
      expect(jobId).not.toContain("user-123");
    });

    it("generates user-scoped job ID for 'owner' policy", async () => {
      const { generateJobId } = await import("@/server/queue");

      const jobId = generateJobId(
        "https://example.com/recipe",
        "user-123",
        "household-456",
        "owner"
      );

      expect(jobId).toBe("import_user-123_example.com_recipe");
      expect(jobId).toContain("user-123");
      expect(jobId).not.toContain("household-456");
    });

    it("normalizes URLs (lowercase, removes trailing slash)", async () => {
      const { generateJobId } = await import("@/server/queue");

      const jobId1 = generateJobId(
        "https://Example.COM/Recipe/",
        "user-123",
        "household-456",
        "everyone"
      );

      const jobId2 = generateJobId(
        "https://example.com/recipe",
        "user-123",
        "household-456",
        "everyone"
      );

      expect(jobId1).toBe(jobId2);
    });

    it("removes tracking parameters from URLs", async () => {
      const { generateJobId } = await import("@/server/queue");

      const jobId1 = generateJobId(
        "https://example.com/recipe?utm_source=test&utm_medium=email",
        "user-123",
        "household-456",
        "everyone"
      );

      const jobId2 = generateJobId(
        "https://example.com/recipe",
        "user-123",
        "household-456",
        "everyone"
      );

      expect(jobId1).toBe(jobId2);
    });
  });

  describe("isJobInQueue", () => {
    it("returns true when job is waiting", async () => {
      mockGetJob.mockResolvedValue({
        getState: vi.fn().mockResolvedValue("waiting"),
      });

      const { isJobInQueue, recipeImportQueue } = await import("@/server/queue");

      const result = await isJobInQueue(recipeImportQueue, "test-job-id");

      expect(result).toBe(true);
    });

    it("returns true when job is active", async () => {
      mockGetJob.mockResolvedValue({
        getState: vi.fn().mockResolvedValue("active"),
      });

      const { isJobInQueue, recipeImportQueue } = await import("@/server/queue");

      const result = await isJobInQueue(recipeImportQueue, "test-job-id");

      expect(result).toBe(true);
    });

    it("returns true when job is delayed", async () => {
      mockGetJob.mockResolvedValue({
        getState: vi.fn().mockResolvedValue("delayed"),
      });

      const { isJobInQueue, recipeImportQueue } = await import("@/server/queue");

      const result = await isJobInQueue(recipeImportQueue, "test-job-id");

      expect(result).toBe(true);
    });

    it("returns false when job is completed", async () => {
      mockGetJob.mockResolvedValue({
        getState: vi.fn().mockResolvedValue("completed"),
      });

      const { isJobInQueue, recipeImportQueue } = await import("@/server/queue");

      const result = await isJobInQueue(recipeImportQueue, "test-job-id");

      expect(result).toBe(false);
    });

    it("returns false when job is failed", async () => {
      mockGetJob.mockResolvedValue({
        getState: vi.fn().mockResolvedValue("failed"),
      });

      const { isJobInQueue, recipeImportQueue } = await import("@/server/queue");

      const result = await isJobInQueue(recipeImportQueue, "test-job-id");

      expect(result).toBe(false);
    });

    it("returns false when job does not exist", async () => {
      mockGetJob.mockResolvedValue(null);

      const { isJobInQueue, recipeImportQueue } = await import("@/server/queue");

      const result = await isJobInQueue(recipeImportQueue, "nonexistent-job-id");

      expect(result).toBe(false);
    });
  });

  describe("addImportJob", () => {
    const mockPolicy: RecipePermissionPolicy = {
      view: "everyone",
      edit: "household",
      delete: "household",
    };

    beforeEach(() => {
      vi.mocked(getRecipePermissionPolicy).mockResolvedValue(mockPolicy);
      mockGetJob.mockResolvedValue(null); // No existing job
      mockAdd.mockResolvedValue({ id: "new-job-id" });
    });

    it("adds job successfully when no duplicate exists", async () => {
      const { addImportJob } = await import("@/server/queue");

      const result = await addImportJob({
        url: "https://example.com/recipe",
        recipeId: "recipe-123",
        userId: "user-123",
        householdKey: "household-456",
        householdUserIds: ["user-123"],
      });

      expect(mockAdd).toHaveBeenCalledWith(
        "import",
        expect.objectContaining({
          url: "https://example.com/recipe",
          recipeId: "recipe-123",
        }),
        expect.objectContaining({
          jobId: expect.any(String),
        })
      );
      expect(result.status).toBe("queued");
    });

    it("returns duplicate status when job exists in queue", async () => {
      mockGetJob.mockResolvedValue({
        getState: vi.fn().mockResolvedValue("waiting"),
      });

      const { addImportJob } = await import("@/server/queue");

      const result = await addImportJob({
        url: "https://example.com/recipe",
        recipeId: "recipe-123",
        userId: "user-123",
        householdKey: "household-456",
        householdUserIds: ["user-123"],
      });

      expect(result.status).toBe("duplicate");
    });

    it("allows same URL for different households with 'household' policy", async () => {
      vi.mocked(getRecipePermissionPolicy).mockResolvedValue({
        ...mockPolicy,
        view: "household",
      });

      // First call - no existing job
      mockGetJob.mockResolvedValueOnce(null);
      mockAdd.mockResolvedValueOnce({ id: "job-1" });

      const { addImportJob } = await import("@/server/queue");

      // First household
      const result1 = await addImportJob({
        url: "https://example.com/recipe",
        recipeId: "recipe-1",
        userId: "user-1",
        householdKey: "household-1",
        householdUserIds: ["user-1"],
      });

      expect(result1.status).toBe("queued");

      // Second call - no existing job for different household
      mockGetJob.mockResolvedValueOnce(null);
      mockAdd.mockResolvedValueOnce({ id: "job-2" });

      // Different household - should succeed
      const result2 = await addImportJob({
        url: "https://example.com/recipe",
        recipeId: "recipe-2",
        userId: "user-2",
        householdKey: "household-2",
        householdUserIds: ["user-2"],
      });

      expect(result2.status).toBe("queued");
    });

    it("allows same URL for different users with 'owner' policy", async () => {
      vi.mocked(getRecipePermissionPolicy).mockResolvedValue({
        ...mockPolicy,
        view: "owner",
      });

      // First call - no existing job
      mockGetJob.mockResolvedValueOnce(null);
      mockAdd.mockResolvedValueOnce({ id: "job-1" });

      const { addImportJob } = await import("@/server/queue");

      // First user
      const result1 = await addImportJob({
        url: "https://example.com/recipe",
        recipeId: "recipe-1",
        userId: "user-1",
        householdKey: "household-1",
        householdUserIds: ["user-1"],
      });

      expect(result1.status).toBe("queued");

      // Second call - no existing job for different user
      mockGetJob.mockResolvedValueOnce(null);
      mockAdd.mockResolvedValueOnce({ id: "job-2" });

      // Different user - should succeed
      const result2 = await addImportJob({
        url: "https://example.com/recipe",
        recipeId: "recipe-2",
        userId: "user-2",
        householdKey: "household-1",
        householdUserIds: ["user-1", "user-2"],
      });

      expect(result2.status).toBe("queued");
    });

    it("allows re-import after job completes (removed from queue)", async () => {
      // Job exists but is completed (not in active queue)
      mockGetJob.mockResolvedValueOnce({
        getState: vi.fn().mockResolvedValue("completed"),
      });
      mockAdd.mockResolvedValueOnce({ id: "new-job" });

      const { addImportJob } = await import("@/server/queue");

      // Should succeed because completed jobs don't block new imports
      const result = await addImportJob({
        url: "https://example.com/recipe",
        recipeId: "recipe-123",
        userId: "user-123",
        householdKey: "household-456",
        householdUserIds: ["user-123"],
      });

      expect(result.status).toBe("queued");
    });

    it("allows re-import after job fails (removed from queue)", async () => {
      // Job exists but is failed
      mockGetJob.mockResolvedValueOnce({
        getState: vi.fn().mockResolvedValue("failed"),
      });
      mockAdd.mockResolvedValueOnce({ id: "new-job" });

      const { addImportJob } = await import("@/server/queue");

      // Should succeed because failed jobs don't block new imports
      const result = await addImportJob({
        url: "https://example.com/recipe",
        recipeId: "recipe-123",
        userId: "user-123",
        householdKey: "household-456",
        householdUserIds: ["user-123"],
      });

      expect(result.status).toBe("queued");
    });
  });

  describe("Queue deduplication by policy", () => {
    describe("everyone policy", () => {
      beforeEach(() => {
        vi.mocked(getRecipePermissionPolicy).mockResolvedValue({
          view: "everyone",
          edit: "household",
          delete: "household",
        });
      });

      it("returns duplicate for same URL globally regardless of user/household", async () => {
        // First job exists and is active
        mockGetJob.mockResolvedValue({
          getState: vi.fn().mockResolvedValue("active"),
        });

        const { addImportJob } = await import("@/server/queue");

        // Different user, different household, same URL
        const result = await addImportJob({
          url: "https://example.com/recipe",
          recipeId: "recipe-999",
          userId: "different-user",
          householdKey: "different-household",
          householdUserIds: ["different-user"],
        });

        expect(result.status).toBe("duplicate");
      });
    });

    describe("household policy", () => {
      beforeEach(() => {
        vi.mocked(getRecipePermissionPolicy).mockResolvedValue({
          view: "household",
          edit: "household",
          delete: "household",
        });
      });

      it("returns duplicate for same URL within same household", async () => {
        mockGetJob.mockResolvedValue({
          getState: vi.fn().mockResolvedValue("active"),
        });

        const { addImportJob } = await import("@/server/queue");

        // Same household, different user
        const result = await addImportJob({
          url: "https://example.com/recipe",
          recipeId: "recipe-2",
          userId: "user-2",
          householdKey: "household-1", // Same household
          householdUserIds: ["user-1", "user-2"],
        });

        expect(result.status).toBe("duplicate");
      });
    });

    describe("owner policy", () => {
      beforeEach(() => {
        vi.mocked(getRecipePermissionPolicy).mockResolvedValue({
          view: "owner",
          edit: "owner",
          delete: "owner",
        });
      });

      it("returns duplicate for same URL for same user only", async () => {
        mockGetJob.mockResolvedValue({
          getState: vi.fn().mockResolvedValue("active"),
        });

        const { addImportJob } = await import("@/server/queue");

        // Same user
        const result = await addImportJob({
          url: "https://example.com/recipe",
          recipeId: "recipe-2",
          userId: "user-1", // Same user
          householdKey: "household-1",
          householdUserIds: ["user-1"],
        });

        expect(result.status).toBe("duplicate");
      });
    });
  });
});
