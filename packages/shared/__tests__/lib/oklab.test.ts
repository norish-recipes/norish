import { describe, expect, it } from "vitest";

import { dishHueChroma, MAX_DISH_TINT_CHROMA } from "@norish/shared/lib/oklab";

describe("dishHueChroma", () => {
  it("reads nothing from a missing or unreadable colour", () => {
    expect(dishHueChroma(null)).toBeNull();
    expect(dishHueChroma("orange")).toBeNull();
    expect(dishHueChroma("#fff")).toBeNull();
  });

  it("clamps a vivid colour's chroma and gives a grey no hue", () => {
    expect(dishHueChroma("#ff0000")!.c).toBe(MAX_DISH_TINT_CHROMA);
    expect(dishHueChroma("#808080")).toEqual({ h: 0, c: 0 });
  });
});
