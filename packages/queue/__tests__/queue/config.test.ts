// @vitest-environment node

import { describe, expect, it } from "vitest";

import { RECIPE_IMPORT_PROCESSING_TIMEOUT_MS } from "@norish/queue/config";

describe("Queue config", () => {
  it("sets a max processing time for recipe import jobs", () => {
    expect(RECIPE_IMPORT_PROCESSING_TIMEOUT_MS).toBe(30 * 60 * 1000);
  });
});
