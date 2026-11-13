import { describe, expect, it, vi } from "vitest";

import { ownerAllows } from "../owner-access";

describe("ownerAllows", () => {
  it("asks the check about an owned row", () => {
    const check = vi.fn((id: string) => id === "me");

    expect(ownerAllows("me", check)).toBe(true);
    expect(ownerAllows("other", check)).toBe(false);
  });

  it("allows an orphaned row without asking", () => {
    const check = vi.fn(() => false);

    expect(ownerAllows(null, check)).toBe(true);
    expect(ownerAllows(undefined, check)).toBe(true);
    expect(check).not.toHaveBeenCalled();
  });
});
