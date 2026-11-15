import {
  DAY_CARD,
  DAY_CARD_CLASS,
  dayCardHeight,
  dayCardOffsets,
} from "@/components/day-card-height";
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

/** A spacing class in points: `pt-0.5` is 2, `h-[50px]` is 50. */
function points(classes: string, prefix: string) {
  const token = classes.split(" ").find((name) => name.startsWith(`${prefix}-`));
  const value = token?.slice(prefix.length + 1);

  if (value === undefined) return Number.NaN;
  if (value.endsWith("px]")) return Number.parseFloat(value.slice(1));

  return Number.parseFloat(value) * 4;
}

describe("DAY_CARD", () => {
  it("adds up what the classes say", () => {
    expect(DAY_CARD.top).toBe(points(DAY_CARD_CLASS.card, "pt"));
    expect(DAY_CARD.bottom).toBe(points(DAY_CARD_CLASS.card, "pb"));
    expect(DAY_CARD.header).toBe(points(DAY_CARD_CLASS.header, "h"));
    expect(DAY_CARD.row).toBe(points(DAY_CARD_CLASS.row, "h") + points(DAY_CARD_CLASS.slot, "gap"));
    expect(DAY_CARD.slot).toBe(
      1 + 2 * points(DAY_CARD_CLASS.slot, "py") + points(DAY_CARD_CLASS.slotLabel, "h")
    );
  });

  it("gives the skeleton the height of a day with one planned item", () => {
    expect(points(DAY_CARD_CLASS.skeleton, "h")).toBe(dayCardHeight([{ slot: "Lunch" }]));
  });
});
