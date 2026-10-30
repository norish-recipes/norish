// @vitest-environment node
/**
 * What each scheduled task runs.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  registerQueueApiHandlers,
  resetQueueApiHandlersForTests,
} from "@norish/queue/api-handlers";
import { closeWorkers } from "@norish/queue/create-worker";
import { startScheduledTasksWorker } from "@norish/queue/scheduled-tasks/worker";

const scheduler = vi.hoisted(() => ({ checkRecurringGroceries: vi.fn() }));
const seed = vi.hoisted(() => ({ refreshIngredientCatalogue: vi.fn() }));
const recheck = vi.hoisted(() => ({ recheckUndecidedMintsOnRungChange: vi.fn() }));
const catalogue = vi.hoisted(() => ({ sweepUnusedIngredients: vi.fn() }));
const aiChanges = vi.hoisted(() => ({ sweepAIChanges: vi.fn(async () => 0) }));
const captured = vi.hoisted(() => ({
  processor: undefined as ((job: unknown) => Promise<unknown>) | undefined,
}));

vi.mock("bullmq", async (importOriginal) => {
  const actual = await importOriginal<typeof import("bullmq")>();

  class MockWorker {
    on = vi.fn();
    pause = vi.fn(async () => undefined);
    cancelAllJobs = vi.fn();
    close = vi.fn(async () => undefined);

    constructor(_queueName: string, processor: (job: unknown) => Promise<unknown>) {
      captured.processor = processor;
    }
  }

  return { ...actual, Worker: MockWorker };
});
vi.mock("@norish/queue/valkey/bullmq", () => ({ getBullClient: vi.fn() }));
vi.mock("@norish/queue/scheduler/recurring-grocery-check", () => scheduler);
vi.mock("@norish/queue/scheduler/old-calendar-cleanup", () => ({
  cleanupOldCalendarData: vi.fn(),
}));
vi.mock("@norish/queue/scheduler/old-groceries-cleanup", () => ({ cleanupOldGroceries: vi.fn() }));
vi.mock("@norish/shared-server/ingredients/seed/catalogue-seed", () => seed);
vi.mock("@norish/shared-server/ingredients/seed/recheck-mints", () => recheck);
vi.mock("@norish/shared-server/ingredients/catalogue", () => catalogue);
vi.mock("@norish/db/repositories/ingredient-ai-changes", () => aiChanges);
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
    await closeWorkers(0);
  });

  function jobFor(taskType: string) {
    const job = {
      id: `job-${taskType}`,
      attemptsMade: 0,
      data: { taskType },
      progress: {} as unknown,
      updateProgress: vi.fn(async (progress: unknown) => {
        job.progress = progress;
      }),
      log: vi.fn(async () => 0),
    };

    return job;
  }

  it("refreshes the ingredient catalogue, and fails the job where the refresh fails", async () => {
    seed.refreshIngredientCatalogue.mockResolvedValueOnce("applied");
    await captured.processor!(jobFor("ingredient-catalogue-refresh"));
    expect(seed.refreshIngredientCatalogue).toHaveBeenCalledTimes(1);
    // A file applied may be the first seed: the mints made without it are looked at again.
    expect(recheck.recheckUndecidedMintsOnRungChange).toHaveBeenCalledTimes(1);

    seed.refreshIngredientCatalogue.mockResolvedValueOnce("unchanged");
    await captured.processor!(jobFor("ingredient-catalogue-refresh"));
    expect(recheck.recheckUndecidedMintsOnRungChange).toHaveBeenCalledTimes(1);

    seed.refreshIngredientCatalogue.mockRejectedValueOnce(new Error("HTTP 503"));
    await expect(captured.processor!(jobFor("ingredient-catalogue-refresh"))).rejects.toThrow(
      "HTTP 503"
    );
  });

  it("sweeps the catalogue of foods nothing names, and the old AI Changes", async () => {
    catalogue.sweepUnusedIngredients.mockResolvedValueOnce({ deleted: 2 });
    await captured.processor!(jobFor("ingredient-sweep"));
    expect(catalogue.sweepUnusedIngredients).toHaveBeenCalledTimes(1);
    expect(aiChanges.sweepAIChanges).toHaveBeenCalledTimes(1);
  });
});
