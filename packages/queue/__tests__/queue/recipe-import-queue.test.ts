/**
 * Recipe Import Queue Tests
 *
 * Tests for BullMQ recipe import queue with policy-aware deduplication.
 */

// @vitest-environment node

import type { Queue } from "bullmq";
import { beforeEach, describe, expect, it, vi } from "vitest";

// eslint-disable-next-line import/order -- Type imports must come after mocks are set up in test files
import type { RecipePermissionPolicy } from "@norish/config/zod/server-config";
import type { RecipeImportJobData } from "@norish/queue/contracts/job-types";
import { getRecipePermissionPolicy } from "@norish/shared-server/config/server-config-loader";

// Mock BullMQ
const mockAdd = vi.fn();
const mockGetJob = vi.fn();
const mockClose = vi.fn();

// Create a mock queue instance for tests - typed to match Queue interface
const mockQueue: Pick<Queue<RecipeImportJobData>, "add" | "getJob" | "close"> = {
  add: mockAdd,
  getJob: mockGetJob,
  close: mockClose,
};

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
vi.mock("@norish/shared-server/config/server-config-loader", () => ({
  getRecipePermissionPolicy: vi.fn(),
}));

// Mock server config
vi.mock("@norish/config/env-config-server", () => ({
  SERVER_CONFIG: {
    MASTER_KEY: "QmFzZTY0RW5jb2RlZE1hc3RlcktleU1pbjMyQ2hhcnM=",
    REDIS_URL: "redis://localhost:6379",
    UPLOADS_DIR: "/tmp/uploads",
    YT_DLP_BIN_DIR: "/tmp/bin",
  },
}));

// Mock queue config to avoid URL parsing issues
vi.mock("@norish/queue/config", () => ({
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
  autoTaggingJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: true,
    removeOnFail: true,
  },
  allergyDetectionJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: true,
    removeOnFail: true,
  },
  imageImportJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: true,
    removeOnFail: true,
  },
  pasteImportJobOptions: {
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
    AUTO_TAGGING: "auto-tagging",
    ALLERGY_DETECTION: "allergy-detection",
  },
}));

// Mock logger
const mockLogger = {
  info: vi.fn(),
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn(() => mockLogger),
};

vi.mock("@norish/shared-server/logger", () => ({
  createLogger: vi.fn(() => mockLogger),
  parserLogger: mockLogger,
}));

// Mock DB functions
const mockRecipeExistsByUrlForPolicy = vi.fn();

vi.mock("@norish/db", () => ({
  recipeExistsByUrlForPolicy: mockRecipeExistsByUrlForPolicy,
}));

type FakeJob = {
  id: string;
  data: RecipeImportJobData;
  state: string;
  getState: () => Promise<string>;
  remove: () => Promise<void>;
};

/**
 * Stateful stand-in for a BullMQ queue, modeling the two semantics the
 * producer depends on: `add` against an occupied job id is a no-op that
 * returns the existing job, and `remove` frees the id.
 */
function createFakeQueue() {
  const jobs = new Map<string, FakeJob>();

  const makeJob = (id: string, data: RecipeImportJobData, state: string): FakeJob => {
    const job: FakeJob = {
      id,
      data,
      state,
      getState: async () => job.state,
      remove: async () => {
        jobs.delete(id);
      },
    };

    return job;
  };

  return {
    jobs,
    seed(id: string, state: string, data: RecipeImportJobData): FakeJob {
      const job = makeJob(id, data, state);

      jobs.set(id, job);

      return job;
    },
    getJob: async (id: string) => jobs.get(id),
    add: async (_name: string, data: RecipeImportJobData, opts: { jobId: string }) => {
      const existing = jobs.get(opts.jobId);

      if (existing) return existing;

      const job = makeJob(opts.jobId, data, "waiting");

      jobs.set(opts.jobId, job);

      return job;
    },
  };
}

function importData(overrides: Partial<RecipeImportJobData> = {}): RecipeImportJobData {
  return {
    url: "https://example.com/recipe",
    recipeId: "recipe-123",
    userId: "user-123",
    householdKey: "household-456",
    householdUserIds: ["user-123"],
    ...overrides,
  };
}

describe("Recipe Import Queue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no existing recipe in DB
    mockRecipeExistsByUrlForPolicy.mockResolvedValue({ exists: false });
  });

  describe("generateJobId", () => {
    it("generates global job ID for 'everyone' policy", async () => {
      const { generateJobId } = await import("@norish/queue/helpers");

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
      const { generateJobId } = await import("@norish/queue/helpers");

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
      const { generateJobId } = await import("@norish/queue/helpers");

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
      const { generateJobId } = await import("@norish/queue/helpers");

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
      const { generateJobId } = await import("@norish/queue/helpers");

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

      const { isJobInQueue } = await import("@norish/queue/helpers");

      const result = await isJobInQueue(mockQueue as any, "test-job-id");

      expect(result).toBe(true);
    });

    it("returns true when job is active", async () => {
      mockGetJob.mockResolvedValue({
        getState: vi.fn().mockResolvedValue("active"),
      });

      const { isJobInQueue } = await import("@norish/queue/helpers");

      const result = await isJobInQueue(mockQueue as any, "test-job-id");

      expect(result).toBe(true);
    });

    it("returns true when job is delayed", async () => {
      mockGetJob.mockResolvedValue({
        getState: vi.fn().mockResolvedValue("delayed"),
      });

      const { isJobInQueue } = await import("@norish/queue/helpers");

      const result = await isJobInQueue(mockQueue as any, "test-job-id");

      expect(result).toBe(true);
    });

    it("returns false when job is completed", async () => {
      mockGetJob.mockResolvedValue({
        getState: vi.fn().mockResolvedValue("completed"),
      });

      const { isJobInQueue } = await import("@norish/queue/helpers");

      const result = await isJobInQueue(mockQueue as any, "test-job-id");

      expect(result).toBe(false);
    });

    it("returns false when job is failed", async () => {
      mockGetJob.mockResolvedValue({
        getState: vi.fn().mockResolvedValue("failed"),
      });

      const { isJobInQueue } = await import("@norish/queue/helpers");

      const result = await isJobInQueue(mockQueue as any, "test-job-id");

      expect(result).toBe(false);
    });

    it("returns false when job does not exist", async () => {
      mockGetJob.mockResolvedValue(null);

      const { isJobInQueue } = await import("@norish/queue/helpers");

      const result = await isJobInQueue(mockQueue as any, "nonexistent-job-id");

      expect(result).toBe(false);
    });
  });

  describe("addImportJob", () => {
    const mockPolicy: RecipePermissionPolicy = {
      view: "everyone",
      edit: "household",
      delete: "household",
    };

    let queue: ReturnType<typeof createFakeQueue>;

    beforeEach(() => {
      vi.mocked(getRecipePermissionPolicy).mockResolvedValue(mockPolicy);
      queue = createFakeQueue();
    });

    it("adds job successfully when no duplicate exists", async () => {
      const { addImportJob } = await import("@norish/queue/recipe-import/producer");

      const result = await addImportJob(queue as any, importData());

      expect(result.status).toBe("queued");

      const stored = queue.jobs.get("import_example.com_recipe");

      expect(stored?.data).toMatchObject({
        url: "https://example.com/recipe",
        recipeId: "recipe-123",
      });
      expect(stored?.state).toBe("waiting");
    });

    it.each(["waiting", "active", "delayed"])(
      "returns duplicate and leaves the job alone while a %s job holds the id",
      async (state) => {
        const seeded = queue.seed(
          "import_example.com_recipe",
          state,
          importData({ recipeId: "in-flight" })
        );

        const { addImportJob } = await import("@norish/queue/recipe-import/producer");

        const result = await addImportJob(queue as any, importData());

        expect(result).toEqual({
          status: "duplicate",
          existingJobId: "import_example.com_recipe",
        });
        expect(queue.jobs.get("import_example.com_recipe")).toBe(seeded);
      }
    );

    it("allows same URL for different households with 'household' policy", async () => {
      vi.mocked(getRecipePermissionPolicy).mockResolvedValue({
        ...mockPolicy,
        view: "household",
      });

      const { addImportJob } = await import("@norish/queue/recipe-import/producer");

      const result1 = await addImportJob(
        queue as any,
        importData({
          recipeId: "recipe-1",
          userId: "user-1",
          householdKey: "household-1",
          householdUserIds: ["user-1"],
        })
      );

      const result2 = await addImportJob(
        queue as any,
        importData({
          recipeId: "recipe-2",
          userId: "user-2",
          householdKey: "household-2",
          householdUserIds: ["user-2"],
        })
      );

      expect(result1.status).toBe("queued");
      expect(result2.status).toBe("queued");
      expect(queue.jobs.has("import_household-1_example.com_recipe")).toBe(true);
      expect(queue.jobs.has("import_household-2_example.com_recipe")).toBe(true);
    });

    it("allows same URL for different users with 'owner' policy", async () => {
      vi.mocked(getRecipePermissionPolicy).mockResolvedValue({
        ...mockPolicy,
        view: "owner",
      });

      const { addImportJob } = await import("@norish/queue/recipe-import/producer");

      const result1 = await addImportJob(
        queue as any,
        importData({
          recipeId: "recipe-1",
          userId: "user-1",
          householdKey: "household-1",
          householdUserIds: ["user-1"],
        })
      );

      const result2 = await addImportJob(
        queue as any,
        importData({
          recipeId: "recipe-2",
          userId: "user-2",
          householdKey: "household-1",
          householdUserIds: ["user-1", "user-2"],
        })
      );

      expect(result1.status).toBe("queued");
      expect(result2.status).toBe("queued");
      expect(queue.jobs.has("import_user-1_example.com_recipe")).toBe(true);
      expect(queue.jobs.has("import_user-2_example.com_recipe")).toBe(true);
    });

    it.each(["completed", "failed"])(
      "re-import removes the retained %s job and queues a fresh one",
      async (state) => {
        // The recipe was deleted after this import finished; only the retained
        // BullMQ job under the deterministic id is left behind (issue #524).
        queue.seed("import_example.com_recipe", state, importData({ recipeId: "old-recipe" }));

        const { addImportJob } = await import("@norish/queue/recipe-import/producer");

        const result = await addImportJob(queue as any, importData({ recipeId: "new-recipe" }));

        expect(result.status).toBe("queued");

        const stored = queue.jobs.get("import_example.com_recipe");

        expect(stored?.data.recipeId).toBe("new-recipe");
        expect(stored?.state).toBe("waiting");
      }
    );

    it("rejects instead of reporting queued when the retained job cannot be removed", async () => {
      const seeded = queue.seed(
        "import_example.com_recipe",
        "completed",
        importData({ recipeId: "old-recipe" })
      );

      seeded.remove = async () => {
        throw new Error("locked");
      };

      const { addImportJob } = await import("@norish/queue/recipe-import/producer");

      await expect(addImportJob(queue as any, importData())).rejects.toThrow(
        "Could not remove retained job"
      );
      expect(queue.jobs.get("import_example.com_recipe")?.data.recipeId).toBe("old-recipe");
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.anything(),
        "Recipe import job added to queue"
      );
    });

    it("reports duplicate when a concurrent add wins the job id race", async () => {
      const seeded = queue.seed(
        "import_example.com_recipe",
        "completed",
        importData({ recipeId: "old-recipe" })
      );

      // Removing succeeds, but a rival producer claims the freed id before our add.
      seeded.remove = async () => {
        queue.seed(
          "import_example.com_recipe",
          "waiting",
          importData({ recipeId: "rival-recipe" })
        );
      };

      const { addImportJob } = await import("@norish/queue/recipe-import/producer");

      const result = await addImportJob(queue as any, importData({ recipeId: "new-recipe" }));

      expect(result).toEqual({
        status: "duplicate",
        existingJobId: "import_example.com_recipe",
      });
      expect(queue.jobs.get("import_example.com_recipe")?.data.recipeId).toBe("rival-recipe");
      expect(mockLogger.info).not.toHaveBeenCalledWith(
        expect.anything(),
        "Recipe import job added to queue"
      );
    });
  });

  describe("Queue deduplication by policy", () => {
    let queue: ReturnType<typeof createFakeQueue>;

    beforeEach(() => {
      queue = createFakeQueue();
    });

    describe("everyone policy", () => {
      beforeEach(() => {
        vi.mocked(getRecipePermissionPolicy).mockResolvedValue({
          view: "everyone",
          edit: "household",
          delete: "household",
        });
      });

      it("returns duplicate for same URL globally regardless of user/household", async () => {
        queue.seed("import_example.com_recipe", "active", importData());

        const { addImportJob } = await import("@norish/queue/recipe-import/producer");

        // Different user, different household, same URL
        const result = await addImportJob(
          queue as any,
          importData({
            recipeId: "recipe-999",
            userId: "different-user",
            householdKey: "different-household",
            householdUserIds: ["different-user"],
          })
        );

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
        queue.seed(
          "import_household-1_example.com_recipe",
          "active",
          importData({ userId: "user-1", householdKey: "household-1" })
        );

        const { addImportJob } = await import("@norish/queue/recipe-import/producer");

        // Same household, different user
        const result = await addImportJob(
          queue as any,
          importData({
            recipeId: "recipe-2",
            userId: "user-2",
            householdKey: "household-1", // Same household
            householdUserIds: ["user-1", "user-2"],
          })
        );

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
        queue.seed(
          "import_user-1_example.com_recipe",
          "active",
          importData({ userId: "user-1", householdKey: "household-1" })
        );

        const { addImportJob } = await import("@norish/queue/recipe-import/producer");

        // Same user
        const result = await addImportJob(
          queue as any,
          importData({
            recipeId: "recipe-2",
            userId: "user-1", // Same user
            householdKey: "household-1",
            householdUserIds: ["user-1"],
          })
        );

        expect(result.status).toBe("duplicate");
      });
    });
  });
});
