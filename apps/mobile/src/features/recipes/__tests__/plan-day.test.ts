import { planDay } from "@/features/recipes/utils/plan-day";
import { describe, expect, it } from "vitest";

const strip = (from: number) => [0, 1, 2].map((offset) => new Date(2026, 10, from + offset));

describe("planDay", () => {
  it("follows today while no day is picked", () => {
    expect(planDay(null, strip(13))).toEqual(new Date(2026, 10, 13));
    expect(planDay(null, strip(14))).toEqual(new Date(2026, 10, 14));
  });

  it("keeps a picked day that is still on the strip", () => {
    expect(planDay(new Date(2026, 10, 15), strip(14))).toEqual(new Date(2026, 10, 15));
  });

  it("falls back to today when the picked day left the strip", () => {
    expect(planDay(new Date(2026, 10, 13), strip(14))).toEqual(new Date(2026, 10, 14));
  });
});
