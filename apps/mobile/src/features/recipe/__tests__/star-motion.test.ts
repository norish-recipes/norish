import { describe, expect, it } from "vitest";

import { STAR_STAGGER_MS, starMotion } from "../utils/star-motion";

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
