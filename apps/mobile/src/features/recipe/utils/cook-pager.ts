export const PEEK_SCALE = 0.86;
export const PEEK_OPACITY = 0.22;
/** The fixed height of the peek slots above and below the current step. */
export const PEEK_SLOT = 96;
/** The finger travel that moves the column by one step. */
export const DRAG_DISTANCE = 220;

type Pose = { opacity: number; y: number; scale: number };

function clamp(value: number, min: number, max: number) {
  "worklet";

  return Math.min(max, Math.max(min, value));
}

/**
 * Where the three slots sit for a drag of `drag` steps: +1 is the next step fully in the
 * centre, -1 the previous one. `region` is the current step's height.
 */
export function pagerPose(
  drag: number,
  region: number
): { top: Pose; current: Pose; bottom: Pose } {
  "worklet";

  const next = clamp(drag, 0, 1);
  const back = clamp(-drag, 0, 1);
  const away = next + back;
  const grow = (amount: number) => PEEK_SCALE + amount * (1 - PEEK_SCALE);

  return {
    top: {
      y: (back - next) * PEEK_SLOT,
      scale: grow(back),
      opacity: next > 0 ? PEEK_OPACITY * (1 - next) : PEEK_OPACITY + back * (1 - PEEK_OPACITY),
    },
    current: {
      y: back * region - next * PEEK_SLOT,
      scale: 1 - away * (1 - PEEK_SCALE),
      opacity: 1 - away * (1 - PEEK_OPACITY),
    },
    bottom: {
      y: back * PEEK_SLOT - next * region,
      scale: grow(next),
      opacity: next > 0 ? PEEK_OPACITY + next * (1 - PEEK_OPACITY) : PEEK_OPACITY * (1 - back),
    },
  };
}

/** The step offset a release snaps to: where the velocity carries `drag`, within `min`..`max`. */
export function settleTarget(drag: number, velocity: number, min: number, max: number) {
  "worklet";

  return clamp(Math.round(drag + velocity * 0.2), min, max);
}
