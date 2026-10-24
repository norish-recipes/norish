// @vitest-environment node

import { describe, expect, it } from "vitest";

import {
  buildRemovalOptions,
  QUEUE_SETTINGS,
  RECIPE_IMPORT_PROCESSING_TIMEOUT_MS,
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
    for (const { jobOptions } of Object.values(QUEUE_SETTINGS)) {
      expect(jobOptions.removeOnComplete).not.toBe(true);
      expect(jobOptions.removeOnFail).not.toBe(true);
    }
  });

  it("defines a hanging threshold for every queue", () => {
    for (const { hangingThresholdMs } of Object.values(QUEUE_SETTINGS)) {
      expect(hangingThresholdMs).toBeGreaterThan(0);
    }
  });
});
