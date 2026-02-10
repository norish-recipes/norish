// @vitest-environment node

import { describe, it, expect } from "vitest";

import { withTimeout } from "@/server/queue/helpers";

describe("withTimeout", () => {
  it("rejects when operation exceeds timeout", async () => {
    await expect(
      withTimeout(() => new Promise((resolve) => setTimeout(resolve, 50)), 10, "test operation")
    ).rejects.toThrow("test operation timed out after 10ms");
  });

  it("returns result when operation finishes in time", async () => {
    const result = await withTimeout(async () => "ok", 100, "quick operation");

    expect(result).toBe("ok");
  });
});
