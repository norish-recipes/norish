import { describe, expect, it } from "vitest";

import type { StarTap } from "../utils/star-motion";
import { liveTap, STAR_STAGGER_MS, starMotion } from "../utils/star-motion";

const row = (from: number, to: number) => [1, 2, 3, 4, 5].map((star) => starMotion(star, from, to));
const still = { delay: 0, pop: false };

describe("starMotion", () => {
  it("fills 1 → 5 from star 2, one step apart", () => {
    expect(row(1, 5)).toEqual([
      still,
      { delay: 0, pop: true },
      { delay: STAR_STAGGER_MS, pop: true },
      { delay: 2 * STAR_STAGGER_MS, pop: true },
      { delay: 3 * STAR_STAGGER_MS, pop: true },
    ]);
  });

  it("starts 3 → 5 at star 4 with no wait", () => {
    expect(row(3, 5)).toEqual([
      still,
      still,
      still,
      { delay: 0, pop: true },
      { delay: STAR_STAGGER_MS, pop: true },
    ]);
  });

  it.each([
    [5, 2],
    [4, 0],
    [3, 3],
  ])("moves %i → %i without a wait or a pop", (from, to) => {
    expect(row(from, to)).toEqual([still, still, still, still, still]);
  });
});

/** Whether each rating the stars show in turn animates, after a tap from 3 to 5. */
function animates(shownInTurn: number[]) {
  let tap: StarTap | null = { from: 3, to: 5, reached: false };

  return shownInTurn.map((shown) => {
    tap = liveTap(tap, shown);

    return tap?.reached ?? false;
  });
}

describe("liveTap", () => {
  it("animates the tap once its value shows, and not the server's echo of it", () => {
    expect(animates([3, 5, 5])).toEqual([false, true, true]);
  });

  it("shows a later change away and back to the tapped value as it arrives", () => {
    expect(animates([3, 5, 2, 5])).toEqual([false, true, false, false]);
  });

  it("snaps back on a rollback after a failed save", () => {
    expect(animates([3, 5, 3])).toEqual([false, true, false]);
  });

  it("keeps the same tap while nothing changes, so a render settles", () => {
    const tap = { from: 3, to: 5, reached: true };

    expect(liveTap(tap, 5)).toBe(tap);
    expect(liveTap(null, 5)).toBeNull();
  });
});
