import { describe, expect, it, vi } from "vitest";

vi.mock("react-native-reanimated", () => ({
  Extrapolation: { CLAMP: "clamp" },
  interpolate: (x: number, [from, to]: number[], [low, high]: number[]) =>
    (low ?? 0) +
    Math.min(Math.max((x - (from ?? 0)) / ((to ?? 1) - (from ?? 0)), 0), 1) *
      ((high ?? 1) - (low ?? 0)),
}));

const { progress } = await import("@/lib/motion/progress");

describe("progress", () => {
  it("runs from 0 at the start to 1 at the end", () => {
    expect(progress(100, 100, 300)).toBe(0);
    expect(progress(200, 100, 300)).toBe(0.5);
    expect(progress(300, 100, 300)).toBe(1);
  });

  it("holds at 0 before the start and at 1 after the end", () => {
    expect(progress(0, 100, 300)).toBe(0);
    expect(progress(900, 100, 300)).toBe(1);
  });
});
