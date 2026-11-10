/**
 * The Dish Colour → theme-variable derivation (ADR-0023): hue preserved,
 * saturation clamped, lightness never present — the CSS keeps lightness on
 * the theme's side, which dish-tint-css.test.ts pins at the source level.
 */
import { dishTintStyle, MAX_DISH_TINT_CHROMA } from "@/lib/dish-tint";
import { describe, expect, it } from "vitest";

function hue(style: ReturnType<typeof dishTintStyle>): number {
  return Number(style!["--dish-h"]);
}

function chroma(style: ReturnType<typeof dishTintStyle>): number {
  return Number(style!["--dish-c"]);
}

describe("dishTintStyle", () => {
  it("preserves the colour's OKLCH hue", () => {
    // Reference hues per Ottosson's OKLab for the sRGB primaries.
    expect(hue(dishTintStyle("#ff0000"))).toBeCloseTo(29.23, 1);
    expect(hue(dishTintStyle("#00ff00"))).toBeCloseTo(142.5, 1);
    expect(hue(dishTintStyle("#0000ff"))).toBeCloseTo(264.05, 1);
  });

  it("clamps a saturated colour's chroma to the tint ceiling", () => {
    // Pure red carries ~0.257 chroma; the page may take at most the clamp.
    expect(chroma(dishTintStyle("#ff0000"))).toBe(MAX_DISH_TINT_CHROMA);
    expect(chroma(dishTintStyle("#0000ff"))).toBe(MAX_DISH_TINT_CHROMA);
  });

  it("passes a muted colour's chroma through unclamped", () => {
    // A dull terracotta — the kind of colour food photos actually yield.
    const style = dishTintStyle("#8a7265");

    expect(chroma(style)).toBeGreaterThan(0);
    expect(chroma(style)).toBeLessThan(MAX_DISH_TINT_CHROMA);
  });

  it("treats a neutral grey as hueless rather than amplifying rounding noise", () => {
    const style = dishTintStyle("#808080");

    expect(chroma(style)).toBe(0);
    expect(hue(style)).toBe(0);
  });

  it("emits exactly the two channel variables and never a lightness", () => {
    const style = dishTintStyle("#c04020")!;

    expect(Object.keys(style).sort()).toEqual(["--dish-c", "--dish-h"]);
  });

  it("yields no variables for an absent colour — the one untinted code path", () => {
    expect(dishTintStyle(null)).toBeUndefined();
    expect(dishTintStyle(undefined)).toBeUndefined();
    expect(dishTintStyle("")).toBeUndefined();
  });

  it("yields no variables for a value the extractor would never write", () => {
    expect(dishTintStyle("#fff")).toBeUndefined();
    expect(dishTintStyle("red")).toBeUndefined();
    expect(dishTintStyle("oklch(50% 0.1 30)")).toBeUndefined();
    expect(dishTintStyle("#12345g")).toBeUndefined();
  });
});
