import { describe, expect, it, vi } from "vitest";

// Sampled only at keyTimes, where any easing is 0 or 1 and interpolate returns that keyframe's value.
vi.mock("react-native-reanimated", () => ({
  Easing: { bezierFn: () => (t: number) => t },
  Extrapolation: { CLAMP: "clamp" },
  interpolate: (x: number, input: number[], output: number[]) =>
    output[input.findIndex((keyTime) => Math.abs(keyTime - x) < 1e-9)],
}));

const { STRIKE_TIMING, UPDATE_TIMING, badgeArrow, badgeRing, badgeShake } =
  await import("@/features/auth/utils/badge-motion");

// Update your server's badge: 1.6s; the ring begins at click+0.72s and runs 0.8s.
const BADGE_MS = UPDATE_TIMING.ms;
const at = (keyTime: number) => keyTime * BADGE_MS;
const GLYPH_SCALE = 1.4167;

describe("badge motion at the UpdateServer board's keyTimes", () => {
  it("runs over the board's 1.6s", () => {
    expect(BADGE_MS).toBe(1600);
  });

  it("shakes through the board's offsets", () => {
    const keyTimes = [0, 0.45, 0.53, 0.61, 0.69, 0.77, 0.85, 1];
    const offsets = [0, 0, -7, 7, -5, 4, -2, 0];

    keyTimes.forEach((keyTime, i) =>
      expect(badgeShake(at(keyTime), UPDATE_TIMING)).toBeCloseTo(offsets[i] ?? 0)
    );
  });

  it("lifts the arrow, holds it, drops it past rest and settles it", () => {
    const keyTimes = [0, 0.3, 0.42, 0.52, 0.62, 1];
    const units = [0, -3.5, -3.5, 1, 0, 0];

    keyTimes.forEach((keyTime, i) =>
      expect(badgeArrow(at(keyTime))).toBeCloseTo((units[i] ?? 0) * GLYPH_SCALE)
    );
  });

  it("rings from the badge's edge at 0.6 opacity out to 66, fading to nothing", () => {
    expect(badgeRing(719, UPDATE_TIMING).opacity).toBe(0);
    expect(badgeRing(720, UPDATE_TIMING)).toEqual({ r: 36, opacity: 0.6 });
    expect(badgeRing(720 + 800, UPDATE_TIMING)).toEqual({ r: 66, opacity: 0 });
  });
});

// Sign-in failed and storage unavailable: shake 0.9s from 0.4s, ring from 0.9s for 0.8s.
describe("badge motion at the sign-in failure's keyTimes", () => {
  it("runs to the ring's end, 1.3s after the shake began", () => {
    expect(STRIKE_TIMING.ms).toBe(500 + 800);
  });

  it("shakes through the board's offsets over 0.9s", () => {
    const keyTimes = [0, 0.15, 0.3, 0.45, 0.6, 0.75, 1];
    const offsets = [0, -7, 7, -5, 4, -2, 0];

    keyTimes.forEach((keyTime, i) =>
      expect(badgeShake(keyTime * 900, STRIKE_TIMING)).toBeCloseTo(offsets[i] ?? 0)
    );
  });

  it("starts the ring 0.5s in and ends it at 66, faded out", () => {
    expect(badgeRing(499, STRIKE_TIMING).opacity).toBe(0);
    expect(badgeRing(500, STRIKE_TIMING)).toEqual({ r: 36, opacity: 0.6 });
    expect(badgeRing(1300, STRIKE_TIMING)).toEqual({ r: 66, opacity: 0 });
  });
});
