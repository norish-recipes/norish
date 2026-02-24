import { describe, expect, it } from "vitest";

import { createTRPCProviderBundle } from "@norish/shared/react/providers";

describe("shared react providers exports", () => {
  it("exports shared TRPC provider factory", () => {
    expect(typeof createTRPCProviderBundle).toBe("function");
  });
});
