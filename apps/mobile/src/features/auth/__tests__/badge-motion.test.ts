import { describe, expect, it, vi } from "vitest";

// Sampled only at keyTimes, where any easing is 0 or 1 and interpolate returns that keyframe's value.
vi.mock("react-native-reanimated", () => ({
  Easing: { bezierFn: () => (t: number) => t },
  Extrapolation: { CLAMP: "clamp" },
  interpolate: (x: number, input: number[], output: number[]) =>
    output[input.findIndex((keyTime) => Math.abs(keyTime - x) < 1e-9)],
}));

const { BADGE_MS, badgeArrow, badgeRing, badgeShake } =
  await import("@/features/auth/utils/badge-motion");

// The UpdateServer board, verbatim: dur 1.6s; the ring begins at click+0.72s and runs 0.8s.
const at = (keyTime: number) => keyTime * BADGE_MS;
const GLYPH_SCALE = 1.4167;

describe("badge motion at the UpdateServer board's keyTimes", () => {
  it("runs over the board's 1.6s", () => {
    expect(BADGE_MS).toBe(1600);
  });

  it("shakes through the board's offsets", () => {
    const keyTimes = [0, 0.45, 0.53, 0.61, 0.69, 0.77, 0.85, 1];
    const offsets = [0, 0, -7, 7, -5, 4, -2, 0];

    keyTimes.forEach((keyTime, i) => expect(badgeShake(at(keyTime))).toBeCloseTo(offsets[i] ?? 0));
  });

  it("lifts the arrow, holds it, drops it past rest and settles it", () => {
    const keyTimes = [0, 0.3, 0.42, 0.52, 0.62, 1];
    const units = [0, -3.5, -3.5, 1, 0, 0];

    keyTimes.forEach((keyTime, i) =>
      expect(badgeArrow(at(keyTime))).toBeCloseTo((units[i] ?? 0) * GLYPH_SCALE)
    );
  });

  it("rings from the badge's edge at 0.6 opacity out to 66, fading to nothing", () => {
    expect(badgeRing(719).opacity).toBe(0);
    expect(badgeRing(720)).toEqual({ r: 36, opacity: 0.6 });
    expect(badgeRing(720 + 800)).toEqual({ r: 66, opacity: 0 });
  });
});
