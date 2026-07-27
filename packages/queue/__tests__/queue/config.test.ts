// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  allergyDetectionJobOptions,
  autoCategorizationJobOptions,
  autoTaggingJobOptions,
  buildRemovalOptions,
  caldavSyncJobOptions,
  HANGING_THRESHOLD_MS,
  imageImportJobOptions,
  nutritionEstimationJobOptions,
  pasteImportJobOptions,
  QUEUE_NAMES,
  RECIPE_IMPORT_PROCESSING_TIMEOUT_MS,
  recipeAiEditJobOptions,
  recipeImportJobOptions,
  scheduledTasksJobOptions,
} from "@norish/queue/config";

describe("Queue config", () => {
  it("sets a max processing time for recipe import jobs", () => {
    expect(RECIPE_IMPORT_PROCESSING_TIMEOUT_MS).toBe(30 * 60 * 1000);
  });

  it("builds removal options from retention config", () => {
    const removal = buildRemovalOptions({ keepCompleted: 50, keepFailed: 25, maxAgeDays: 2 });

    expect(removal.removeOnComplete).toEqual({ count: 50, age: 2 * 86_400 });
    expect(removal.removeOnFail).toEqual({ count: 25, age: 2 * 86_400 });
  });

  it("never deletes completed/failed jobs immediately (removeOn*: true)", () => {
    const allOptions = [
      recipeImportJobOptions,
      imageImportJobOptions,
      pasteImportJobOptions,
      caldavSyncJobOptions,
      scheduledTasksJobOptions,
      nutritionEstimationJobOptions,
      autoTaggingJobOptions,
      autoCategorizationJobOptions,
      allergyDetectionJobOptions,
      recipeAiEditJobOptions,
    ];

    for (const options of allOptions) {
      expect(options.removeOnComplete).not.toBe(true);
      expect(options.removeOnFail).not.toBe(true);
    }
  });

  it("defines a hanging threshold for every queue", () => {
    for (const name of Object.values(QUEUE_NAMES)) {
      expect(HANGING_THRESHOLD_MS[name]).toBeGreaterThan(0);
    }
  });
});
