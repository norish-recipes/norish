// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  allergyDetectionJobOptions,
  autoCategorizationJobOptions,
  autoTaggingJobOptions,
  caldavSyncJobOptions,
  imageImportJobOptions,
  nutritionEstimationJobOptions,
  pasteImportJobOptions,
  RECIPE_IMPORT_PROCESSING_TIMEOUT_MS,
  recipeImportJobOptions,
} from "@norish/queue/config";

describe("Queue config", () => {
  it("sets a max processing time for recipe import jobs", () => {
    expect(RECIPE_IMPORT_PROCESSING_TIMEOUT_MS).toBe(30 * 60 * 1000);
  });

  it.each([
    ["recipe import", recipeImportJobOptions],
    ["image import", imageImportJobOptions],
    ["paste import", pasteImportJobOptions],
    ["CalDAV sync", caldavSyncJobOptions],
    ["nutrition estimation", nutritionEstimationJobOptions],
    ["auto-tagging", autoTaggingJobOptions],
    ["auto-categorization", autoCategorizationJobOptions],
    ["allergy detection", allergyDetectionJobOptions],
  ])("releases deterministic IDs after %s jobs reach a terminal state", (_name, options) => {
    expect(options.removeOnComplete).toBe(true);
    expect(options.removeOnFail).toBe(true);
  });
});
