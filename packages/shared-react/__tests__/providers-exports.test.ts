import { describe, expect, it } from "vitest";

import { createTRPCProviderBundle } from "@norish/shared-react/providers";

describe("providers exports", () => {
  it("exports trpc provider factory", () => {
    expect(typeof createTRPCProviderBundle).toBe("function");
  });
});
