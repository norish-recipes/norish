import { describe, expect, it } from "vitest";

import { toSlots, valueMagnitude } from "@norish/shared/lib/rolling-slots";

describe("toSlots", () => {
  it("pads a number at the start and a word at the end", () => {
    expect(toSlots("40", 4, "right")).toEqual([" ", " ", "4", "0"]);
    expect(toSlots("ab", 4, "left")).toEqual(["a", "b", " ", " "]);
  });

  it("pads with the blank it is given and keeps the value's own spaces", () => {
    expect(toSlots("4 ½", 5, "right", "\u2007")).toEqual(["\u2007", "\u2007", "4", " ", "½"]);
  });

  it("keeps a value longer than the slots whole", () => {
    expect(toSlots("1000", 2, "right")).toEqual(["1", "0", "0", "0"]);
  });
});

describe("valueMagnitude", () => {
  it("reads the leading number, with a comma or a point for decimals", () => {
    expect(valueMagnitude("400 g")).toBe(400);
    expect(valueMagnitude("1,5")).toBe(1.5);
    expect(valueMagnitude("-2.5")).toBe(-2.5);
  });

  it("is 0 where a value holds no number", () => {
    expect(valueMagnitude("none")).toBe(0);
  });
});
