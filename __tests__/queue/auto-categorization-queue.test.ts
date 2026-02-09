// @vitest-environment node

import type { Queue } from "bullmq";
import type { AutoCategorizationJobData } from "@/types";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockAdd = vi.fn();
const mockGetJob = vi.fn();
const mockClose = vi.fn();
const mockCreateLazyWorker = vi.fn();
const mockStopLazyWorker = vi.fn();

vi.mock("bullmq", () => {
  return {
    Queue: class MockQueue {
      add = mockAdd;
      getJob = mockGetJob;
      close = mockClose;
    },
    Job: class MockJob {},
  };
});

vi.mock("@/server/queue/lazy-worker-manager", () => ({
  createLazyWorker: mockCreateLazyWorker,
  stopLazyWorker: mockStopLazyWorker,
}));

vi.mock("@/config/env-config-server", () => ({
  SERVER_CONFIG: {
    MASTER_KEY: "QmFzZTY0RW5jb2RlZE1hc3RlcktleU1pbjMyQ2hhcnM=",
    REDIS_URL: "redis://localhost:6379",
    UPLOADS_DIR: "/tmp/uploads",
  },
}));

vi.mock("@/server/queue/config", () => ({
  redisConnection: {
    host: "localhost",
    port: 6379,
    password: undefined,
  },
  autoCategorizationJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: true,
    removeOnFail: true,
  },
  QUEUE_NAMES: {
    AUTO_CATEGORIZATION: "auto-categorization",
  },
  baseWorkerOptions: {},
  STALLED_INTERVAL: {
    "auto-categorization": 60_000,
  },
  WORKER_CONCURRENCY: {
    "auto-categorization": 2,
  },
}));

vi.mock("@/server/redis/bullmq", () => ({
  getBullClient: vi.fn(() => ({
    duplicate: vi.fn(),
  })),
}));

vi.mock("@/server/logger", () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  })),
}));

vi.mock("@/server/queue/helpers", () => ({
  isJobInQueue: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  getRecipeFull: vi.fn(),
  updateRecipeCategories: vi.fn(),
}));

vi.mock("@/server/ai/auto-categorizer", () => ({
  categorizeRecipe: vi.fn(),
}));

vi.mock("@/server/redis/subscription-multiplexer", () => ({
  SubscriptionMultiplexer: vi.fn(),
}));

vi.mock("@/server/trpc/routers/recipes/emitter", () => ({
  recipeEmitter: {
    emitToHousehold: vi.fn(),
    emitToUser: vi.fn(),
    broadcast: vi.fn(),
  },
}));

vi.mock("@/server/redis/socket", () => ({
  emitToHousehold: vi.fn(),
}));

vi.mock("@/server/trpc/helpers", () => ({
  emitByPolicy: vi.fn(),
}));

vi.mock("@/config/server-config-loader", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/config/server-config-loader")>();

  return {
    ...actual,
    isAIEnabled: vi.fn(),
    getRecipePermissionPolicy: vi.fn(),
  };
});

describe("Auto-Categorization Queue", () => {
  let mockQueue: Queue<AutoCategorizationJobData>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateLazyWorker.mockResolvedValue(undefined);
    mockQueue = {
      add: mockAdd,
      getJob: mockGetJob,
      close: mockClose,
    } as unknown as Queue<AutoCategorizationJobData>;
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe("createAutoCategorizationQueue", () => {
    it("creates a queue instance", async () => {
      const { createAutoCategorizationQueue } =
        await import("@/server/queue/auto-categorization/queue");

      const queue = createAutoCategorizationQueue();

      expect(queue).toBeDefined();
      expect(queue.add).toBeDefined();
      expect(queue.close).toBeDefined();
    });
  });

  describe("addAutoCategorizationJob", () => {
    const mockJobData = {
      recipeId: "recipe-123",
      userId: "user-456",
      householdKey: "household-789",
    };

    it("skips job when AI is disabled", async () => {
      const { isAIEnabled } = await import("@/config/server-config-loader");

      vi.mocked(isAIEnabled).mockResolvedValue(false);

      const { addAutoCategorizationJob } =
        await import("@/server/queue/auto-categorization/producer");

      const result = await addAutoCategorizationJob(mockQueue, mockJobData);

      expect(result.status).toBe("skipped");
      if (result.status === "skipped") {
        expect(result.reason).toBe("disabled");
      }
      expect(mockAdd).not.toHaveBeenCalled();
    });

    it("adds job successfully when AI is enabled", async () => {
      const { isAIEnabled } = await import("@/config/server-config-loader");
      const { isJobInQueue } = await import("@/server/queue/helpers");

      vi.mocked(isAIEnabled).mockResolvedValue(true);
      vi.mocked(isJobInQueue).mockResolvedValue(false);
      mockAdd.mockResolvedValue({ id: "auto-categorize-recipe-123" });

      const { addAutoCategorizationJob } =
        await import("@/server/queue/auto-categorization/producer");

      const result = await addAutoCategorizationJob(mockQueue, mockJobData);

      expect(result.status).toBe("queued");
      expect(mockAdd).toHaveBeenCalledWith(
        "auto-categorize",
        mockJobData,
        expect.objectContaining({
          jobId: "auto-categorize-recipe-123",
        })
      );
    });
  });

  describe("processAutoCategorizationJob", () => {
    it("does not overwrite existing categories", async () => {
      const { getRecipeFull, updateRecipeCategories } = await import("@/server/db");
      const { categorizeRecipe } = await import("@/server/ai/auto-categorizer");
      const { getRecipePermissionPolicy } = await import("@/config/server-config-loader");
      const { startAutoCategorizationWorker } =
        await import("@/server/queue/auto-categorization/worker");

      vi.mocked(getRecipePermissionPolicy).mockResolvedValue({
        view: "household",
        edit: "household",
        delete: "household",
      });

      vi.mocked(getRecipeFull).mockResolvedValue({
        id: "recipe-123",
        userId: "user-456",
        name: "Test Recipe",
        description: null,
        url: null,
        image: null,
        servings: 1,
        prepMinutes: null,
        cookMinutes: null,
        totalMinutes: null,
        systemUsed: "metric",
        calories: null,
        fat: null,
        carbs: null,
        protein: null,
        categories: ["Breakfast"],
        createdAt: new Date(),
        updatedAt: new Date(),
        steps: [],
        tags: [],
        recipeIngredients: [],
        author: undefined,
        images: [],
        videos: [],
      });

      await startAutoCategorizationWorker();

      const processor = mockCreateLazyWorker.mock.calls[0]?.[1];

      await processor({
        id: "job-1",
        data: {
          recipeId: "recipe-123",
          userId: "user-456",
          householdKey: "household-789",
        },
        attemptsMade: 0,
        opts: {},
      });

      expect(categorizeRecipe).not.toHaveBeenCalled();
      expect(updateRecipeCategories).not.toHaveBeenCalled();
    });
  });
});
