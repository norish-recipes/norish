import { Easing, Extrapolation, interpolate } from "react-native-reanimated";

// The UpdateServer board's badge, in ms from the replay's start: one shake, the arrow's failed rise, one ring.
export const BADGE_MS = 1600;
export const BADGE_START_DELAY_MS = 400;
// The board begins the ring 0.72s into the badge and runs it 0.8s.
const RING_START = 720;
const RING_MS = 800;
// The ring's radius grows from the badge's own 36 to 66 as its opacity falls from 0.6 to 0.
const RING_FROM_RADIUS = 36;
const RING_TO_RADIUS = 66;
const RING_FROM_OPACITY = 0.6;
// The shake's keyTimes, as fractions of BADGE_MS, and its sideways offsets in points.
const SHAKE_KEY_TIMES = [0, 0.45, 0.53, 0.61, 0.69, 0.77, 0.85, 1];
const SHAKE_OFFSETS = [0, 0, -7, 7, -5, 4, -2, 0];
// The arrow's keyTimes: risen, held, dropped past rest, settled; its offsets in glyph units.
const ARROW_RISEN_AT = 0.3;
const ARROW_HELD_UNTIL = 0.42;
const ARROW_DIPPED_AT = 0.52;
const ARROW_SETTLED_AT = 0.62;
const ARROW_RISEN = -3.5;
const ARROW_DIPPED = 1;
// The board draws the glyph in 24-unit space scaled 1.4167, so its offsets are in those units.
const GLYPH_SCALE = 1.4167;

const arrowRise = Easing.bezierFn(0.3, 0, 0.2, 1);
const arrowDrop = Easing.bezierFn(0.6, 0, 1, 1);
const arrowSettle = Easing.bezierFn(0.2, 0, 0.4, 1);
const ringEase = Easing.bezierFn(0.2, 0.7, 0.3, 1);

/** The badge's sideways shake, in points. */
export function badgeShake(clock: number) {
  "worklet";

  return interpolate(clock / BADGE_MS, SHAKE_KEY_TIMES, SHAKE_OFFSETS, Extrapolation.CLAMP);
}

/** How far `t` is from `start` to `end`, from 0 to 1. */
function span(t: number, start: number, end: number) {
  "worklet";

  return (t - start) / (end - start);
}

/** The arrow's vertical offset in points: it tries to rise, drops past rest, then settles. */
export function badgeArrow(clock: number) {
  "worklet";

  const t = clock / BADGE_MS;
  let units = 0;

  if (t < ARROW_RISEN_AT) units = ARROW_RISEN * arrowRise(span(t, 0, ARROW_RISEN_AT));
  else if (t < ARROW_HELD_UNTIL) units = ARROW_RISEN;
  else if (t < ARROW_DIPPED_AT)
    units =
      ARROW_RISEN +
      (ARROW_DIPPED - ARROW_RISEN) * arrowDrop(span(t, ARROW_HELD_UNTIL, ARROW_DIPPED_AT));
  else if (t < ARROW_SETTLED_AT)
    units = ARROW_DIPPED * (1 - arrowSettle(span(t, ARROW_DIPPED_AT, ARROW_SETTLED_AT)));

  return units * GLYPH_SCALE;
}

/** The ring's radius and opacity: it leaves the badge's edge and fades out as it grows. */
export function badgeRing(clock: number) {
  "worklet";

  const t = Math.min(Math.max(span(clock, RING_START, RING_START + RING_MS), 0), 1);

  return {
    r: RING_FROM_RADIUS + (RING_TO_RADIUS - RING_FROM_RADIUS) * ringEase(t),
    opacity: clock >= RING_START ? RING_FROM_OPACITY * (1 - t) : 0,
  };
}
