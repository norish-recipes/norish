import { describe, expect, it } from "vitest";

import { clampOffset } from "../utils/zoom-offset";

describe("clampOffset", () => {
  it("lets a zoomed picture travel half of what overhangs the screen", () => {
    expect(clampOffset(700, 400, 4)).toBe(600);
    expect(clampOffset(-700, 400, 4)).toBe(-600);
    expect(clampOffset(120, 400, 4)).toBe(120);
  });

  it("pulls an offset back when a pinch lowers the scale", () => {
    expect(clampOffset(600, 400, 1.5)).toBe(100);
  });

  it("centres a picture at 1x or smaller", () => {
    expect(clampOffset(80, 400, 1)).toBeCloseTo(0);
    expect(clampOffset(-80, 400, 0.6)).toBeCloseTo(0);
  });
});
