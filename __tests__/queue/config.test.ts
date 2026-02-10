// @vitest-environment node

import { describe, it, expect } from "vitest";

import { RECIPE_IMPORT_PROCESSING_TIMEOUT_MS } from "@/server/queue/config";

describe("Queue config", () => {
  it("sets a max processing time for recipe import jobs", () => {
    expect(RECIPE_IMPORT_PROCESSING_TIMEOUT_MS).toBe(30 * 60 * 1000);
  });
});
