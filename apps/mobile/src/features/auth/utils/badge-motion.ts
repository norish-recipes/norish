import { Easing, Extrapolation, interpolate } from "react-native-reanimated";

// The UpdateServer board's badge, in ms from the replay's start: one shake, the arrow's failed rise, one ring.
export const BADGE_MS = 1600;
export const BADGE_START_DELAY_MS = 400;
const RING_START = 720;
const RING_MS = 800;
// The board draws the glyph in 24-unit space scaled 1.4167, so its offsets are in those units.
const GLYPH_SCALE = 1.4167;

const arrowRise = Easing.bezierFn(0.3, 0, 0.2, 1);
const arrowDrop = Easing.bezierFn(0.6, 0, 1, 1);
const arrowSettle = Easing.bezierFn(0.2, 0, 0.4, 1);
const ringEase = Easing.bezierFn(0.2, 0.7, 0.3, 1);

/** The badge's sideways shake, in points. */
export function badgeShake(clock: number) {
  "worklet";

  return interpolate(
    clock / BADGE_MS,
    [0, 0.45, 0.53, 0.61, 0.69, 0.77, 0.85, 1],
    [0, 0, -7, 7, -5, 4, -2, 0],
    Extrapolation.CLAMP
  );
}

/** The arrow's vertical offset in points: it tries to rise, drops past rest, then settles. */
export function badgeArrow(clock: number) {
  "worklet";

  const t = clock / BADGE_MS;
  let units = 0;

  if (t < 0.3) units = -3.5 * arrowRise(t / 0.3);
  else if (t < 0.42) units = -3.5;
  else if (t < 0.52) units = -3.5 + 4.5 * arrowDrop((t - 0.42) / 0.1);
  else if (t < 0.62) units = 1 - arrowSettle((t - 0.52) / 0.1);

  return units * GLYPH_SCALE;
}

/** The ring's radius and opacity: it leaves the badge at 36 and fades out by 66. */
export function badgeRing(clock: number) {
  "worklet";

  const t = Math.min(Math.max((clock - RING_START) / RING_MS, 0), 1);

  return { r: 36 + 30 * ringEase(t), opacity: clock >= RING_START ? 0.6 * (1 - t) : 0 };
}
