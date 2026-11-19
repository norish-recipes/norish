import { describe, expect, it } from "vitest";

import { headingText } from "../../src/lib/heading-line";

describe("headingText", () => {
  it("reads a heading past any whitespace `trim` takes, and drops its marks", () => {
    expect(headingText(" ## For the sauce　")).toBe("For the sauce");
    expect(headingText("  # Cook")).toBe("Cook");
  });

  it("is null for a line that is no heading", () => {
    expect(headingText("Add 2 # tins")).toBeNull();
  });
});
