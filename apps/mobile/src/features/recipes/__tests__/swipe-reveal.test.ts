import {
  actionOffset,
  FULL_SWIPE_FLOOR,
  FULL_SWIPE_OVERSHOOT,
  fullSwipeAt,
  swipeZone,
} from "@/features/recipes/utils/swipe-reveal";
import { describe, expect, it } from "vitest";

const offsets = (travel: number, reduceMotion = false) =>
  [0, 1, 2].map((index) => actionOffset(travel, 300, index, 3, reduceMotion));

describe("actionOffset", () => {
  it("hides every action a panel's width away and seats them all once it is open", () => {
    expect(offsets(0)).toEqual([300, 200, 100]);
    expect(offsets(300)).toEqual([0, 0, 0]);
  });

  it("past the open width, moves the first action with the card's edge and leaves the rest", () => {
    expect(offsets(450)).toEqual([-150, 0, 0]);
    expect(offsets(450, true)).toEqual([-150, -150, -150]);
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

// A 402 pt screen: list rows span 20-382 pt, grid cards 20-195 and 207-382 pt.
const LIST_ACTION = 208 / 3;
const list = (count: number) => 8 + LIST_ACTION * count;
const GRID = 84;

describe("fullSwipeAt", () => {
  it("is the open width plus the overshoot wherever the card leaves room", () => {
    expect(fullSwipeAt(list(3), 382)).toBe(list(3) + FULL_SWIPE_OVERSHOOT);
    expect(fullSwipeAt(list(1), 382)).toBe(list(1) + FULL_SWIPE_OVERSHOOT);
    expect(fullSwipeAt(GRID, 382)).toBe(GRID + FULL_SWIPE_OVERSHOOT);
  });

  it("is reachable on a left-column grid card, from its right edge to short of the screen's", () => {
    const at = fullSwipeAt(GRID, 195);

    expect(at).toBeLessThan(195);
    expect(at).toBeGreaterThan(GRID);
  });

  it("is past a swipe that only opens the actions however little room the card leaves", () => {
    expect(fullSwipeAt(list(3), 200)).toBe(list(3) + FULL_SWIPE_FLOOR);
  });
});

describe("swipeZone", () => {
  it("opens past the open threshold and runs the first action past the full swipe", () => {
    const fullAt = fullSwipeAt(GRID, 195);

    expect(swipeZone(30, 40, fullAt)).toBe("closed");
    expect(swipeZone(GRID, 40, fullAt)).toBe("open");
    expect(swipeZone(fullAt, 40, fullAt)).toBe("open");
    expect(swipeZone(fullAt + 1, 40, fullAt)).toBe("full");
  });
});
