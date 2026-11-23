import { describe, expect, it } from "vitest";

import { canCreate } from "../utils/household-rules";

describe("household rules", () => {
  it("needs a name to create", () => {
    expect(canCreate("  ")).toBe(false);
    expect(canCreate("Home")).toBe(true);
  });
});
