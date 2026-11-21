import { describe, expect, it } from "vitest";

import { MIN_SERVINGS, servingsDown, servingsShown, servingsUp } from "../servings";

describe("servingsDown", () => {
  it("takes one off above two servings", () => {
    expect(servingsDown(5)).toBe(4);
    expect(servingsDown(2.5)).toBe(1.5);
  });

  it("goes to one from up to two servings", () => {
    expect(servingsDown(2)).toBe(1);
    expect(servingsDown(1.5)).toBe(1);
  });

  it("halves from one serving down, never below the minimum", () => {
    expect(servingsDown(1)).toBe(0.5);
    expect(servingsDown(0.25)).toBe(0.125);
    expect(servingsDown(0.125)).toBe(MIN_SERVINGS);
  });
});

describe("servingsUp", () => {
  it("doubles below one serving, up to one", () => {
    expect(servingsUp(0.125)).toBe(0.25);
    expect(servingsUp(0.75)).toBe(1);
  });

  it("adds one from one serving up", () => {
    expect(servingsUp(1)).toBe(2);
    expect(servingsUp(1.5)).toBe(2.5);
  });
});

describe("servingsShown", () => {
  it("is the reader's pick when there is one", () => {
    expect(servingsShown(3, 4)).toBe(3);
  });

  it("is the recipe's own servings without a pick", () => {
    expect(servingsShown(null, 4)).toBe(4);
  });

  it("is one when neither is known", () => {
    expect(servingsShown(null, undefined)).toBe(1);
  });
});
