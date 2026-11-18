import { actionOffset, isFullSwipe } from "@/features/recipes/utils/swipe-reveal";
import { describe, expect, it } from "vitest";

const offsets = (travel: number, reduceMotion = false) =>
  [0, 1, 2].map((index) => actionOffset(travel, 300, index, 3, reduceMotion));

describe("actionOffset", () => {
  it("hides every action a panel's width away and seats them all once it is open", () => {
    expect(offsets(0)).toEqual([300, 200, 100]);
    expect(offsets(300)).toEqual([0, 0, 0]);
    expect(offsets(450)).toEqual([0, 0, 0]);
  });

  it("keeps the first action on the card's edge and lets each outer one lag further behind", () => {
    const [first, second, third] = offsets(90);

    expect(first).toBe(210);
    expect(second).toBeCloseTo(140);
    expect(third).toBeCloseTo(70);
    expect(first).toBeGreaterThan(second);
    expect(second).toBeGreaterThan(third);
  });

  it("fans out: on screen, the gap between neighbours (one 100 pt step apart) grows with the finger", () => {
    const gap = (travel: number) => 100 + offsets(travel)[1]! - offsets(travel)[0]!;

    expect(gap(60)).toBeLessThan(gap(150));
  });

  it("moves them as one block under Reduce Motion", () => {
    expect(offsets(90, true)).toEqual([210, 210, 210]);
  });

  it("does not move for a card dragged the wrong way", () => {
    expect(offsets(-20)).toEqual([300, 200, 100]);
  });
});

describe("isFullSwipe", () => {
  it("is a drag past 60% of the card", () => {
    expect(isFullSwipe(210, 350)).toBe(false);
    expect(isFullSwipe(211, 350)).toBe(true);
  });

  it("is never true for an unmeasured card", () => {
    expect(isFullSwipe(500, 0)).toBe(false);
  });
});
