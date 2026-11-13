import { dayCardHeight, dayCardOffsets } from "@/features/recipes/utils/day-card-height";
import { describe, expect, it } from "vitest";

describe("dayCardHeight", () => {
  it("is the header alone for an empty day", () => {
    expect(dayCardHeight([])).toBe(58);
  });

  it("adds a slot's label and rule once, and a row for each item", () => {
    expect(dayCardHeight([{ slot: "Lunch" }])).toBe(58 + 37 + 48);
    expect(dayCardHeight([{ slot: "Lunch" }, { slot: "Lunch" }])).toBe(58 + 37 + 96);
    expect(dayCardHeight([{ slot: "Lunch" }, { slot: "Dinner" }])).toBe(58 + 2 * (37 + 48));
  });
});

describe("dayCardOffsets", () => {
  it("stacks the cards with the gap between, from the start", () => {
    expect(dayCardOffsets([58, 143, 58], 100)).toEqual([100, 170, 325]);
  });
});
