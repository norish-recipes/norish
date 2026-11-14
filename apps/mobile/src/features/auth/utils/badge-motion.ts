import { Easing, Extrapolation, interpolate } from "react-native-reanimated";
import { progress } from "@/lib/motion/progress";

/** One badge's timing: the shake's keyTimes run over `shakeMs`, the ring starts at `ringStart`. */
export type BadgeTiming = {
  /** The whole replay in ms; the clock runs 0 to this. */
  ms: number;
  shakeMs: number;
  shakeKeyTimes: number[];
  shakeOffsets: number[];
  ringStart: number;
};

// The shake and ring start this long after the badge appears, on every status screen.
export const BADGE_START_DELAY_MS = 400;
// The ring runs 0.8s, its radius growing from the badge's 36 to 66 as its opacity falls from 0.6 to 0.
const RING_MS = 800;
const RING_FROM_RADIUS = 36;
const RING_TO_RADIUS = 66;
const RING_FROM_OPACITY = 0.6;

/** UpdateServer: one shake after the arrow's failed rise (1.6s), the ring 0.72s in. */
export const UPDATE_TIMING: BadgeTiming = {
  ms: 1600,
  shakeMs: 1600,
  shakeKeyTimes: [0, 0.45, 0.53, 0.61, 0.69, 0.77, 0.85, 1],
  shakeOffsets: [0, 0, -7, 7, -5, 4, -2, 0],
  ringStart: 720,
};

/** SignInFailed and StorageUnavailable: a 0.9s shake, the ring 0.5s after it began and over at 1.3s. */
export const STRIKE_TIMING: BadgeTiming = {
  ms: 1300,
  shakeMs: 900,
  shakeKeyTimes: [0, 0.15, 0.3, 0.45, 0.6, 0.75, 1],
  shakeOffsets: [0, -7, 7, -5, 4, -2, 0],
  ringStart: 500,
};

// The arrow's keyTimes (fractions of UPDATE_TIMING.ms): risen, held, dropped past rest, settled; offsets in glyph units.
const ARROW_RISEN_AT = 0.3;
const ARROW_HELD_UNTIL = 0.42;
const ARROW_DIPPED_AT = 0.52;
const ARROW_SETTLED_AT = 0.62;
const ARROW_RISEN = -3.5;
const ARROW_DIPPED = 1;
// The glyph is drawn in 24-unit space scaled 1.4167, so its offsets are in those units.
const GLYPH_SCALE = 1.4167;

const arrowRise = Easing.bezierFn(0.3, 0, 0.2, 1);
const arrowDrop = Easing.bezierFn(0.6, 0, 1, 1);
const arrowSettle = Easing.bezierFn(0.2, 0, 0.4, 1);
const ringEase = Easing.bezierFn(0.2, 0.7, 0.3, 1);

/** The badge's sideways shake, in points. */
export function badgeShake(clock: number, timing: BadgeTiming) {
  "worklet";

  return interpolate(
    clock / timing.shakeMs,
    timing.shakeKeyTimes,
    timing.shakeOffsets,
    Extrapolation.CLAMP
  );
}

/** The arrow's vertical offset in points: it tries to rise, drops past rest, then settles. */
export function badgeArrow(clock: number) {
  "worklet";

  const t = clock / UPDATE_TIMING.ms;
  let units = 0;

  if (t < ARROW_RISEN_AT) units = ARROW_RISEN * arrowRise(progress(t, 0, ARROW_RISEN_AT));
  else if (t < ARROW_HELD_UNTIL) units = ARROW_RISEN;
  else if (t < ARROW_DIPPED_AT)
    units =
      ARROW_RISEN +
      (ARROW_DIPPED - ARROW_RISEN) * arrowDrop(progress(t, ARROW_HELD_UNTIL, ARROW_DIPPED_AT));
  else if (t < ARROW_SETTLED_AT)
    units = ARROW_DIPPED * (1 - arrowSettle(progress(t, ARROW_DIPPED_AT, ARROW_SETTLED_AT)));

  return units * GLYPH_SCALE;
}

/** The ring's radius and opacity: it leaves the badge's edge and fades out as it grows. */
export function badgeRing(clock: number, timing: BadgeTiming) {
  "worklet";

  const t = progress(clock, timing.ringStart, timing.ringStart + RING_MS);

  return {
    r: RING_FROM_RADIUS + (RING_TO_RADIUS - RING_FROM_RADIUS) * ringEase(t),
    opacity: clock >= timing.ringStart ? RING_FROM_OPACITY * (1 - t) : 0,
  };
}
