import { describe, expect, it } from "vitest";

import { namesNoFood } from "@norish/shared/lib/ingredient-text";

describe("ingredient text", () => {
  it("names no food in a heading, punctuation alone or an old import's object", () => {
    expect(namesNoFood("# For the sauce")).toBe(true);
    expect(namesNoFood(")")).toBe(true);
    expect(namesNoFood("[object Object]")).toBe(true);
    expect(namesNoFood("onions")).toBe(false);
  });

  it("names no food in an amount alone: a number, a weight or a volume", () => {
    expect(namesNoFood("el")).toBe(true);
    expect(namesNoFood("EL")).toBe(true);
    expect(namesNoFood("1 el")).toBe(true);
    expect(namesNoFood("tl.")).toBe(true);
    expect(namesNoFood("200 g")).toBe(true);
    expect(namesNoFood("200g")).toBe(true);
    expect(namesNoFood("½ cup")).toBe(true);
    expect(namesNoFood("2")).toBe(true);
  });

  it("names a food beside an amount, and in a unit that is no weight or volume", () => {
    expect(namesNoFood("el suiker")).toBe(false);
    expect(namesNoFood("2 eieren")).toBe(false);
    expect(namesNoFood("gram flour")).toBe(false);
    expect(namesNoFood("7up")).toBe(false);
    // Liquorice, and "drop" is a unit too, of no weight or volume.
    expect(namesNoFood("drop")).toBe(false);
  });
});
