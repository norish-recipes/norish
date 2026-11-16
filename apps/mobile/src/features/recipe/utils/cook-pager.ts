export const PEEK_SCALE = 0.86;
export const PEEK_OPACITY = 0.22;
/** The fixed height of the peek slots above and below the current step. */
export const PEEK_SLOT = 96;
/** The finger travel that moves the column by one step. */
export const DRAG_DISTANCE = 220;
/** Seconds of release velocity a settle carries the column on. */
export const VELOCITY_CARRY = 0.2;
/** How far out a full step is gone and its peek starts, so the two layers never show together. */
export const HANDOVER = 0.7;

/** The steps a drag from the current one can reach. */
export type StepReach = { first: number; last: number };

export type SlotPose = { y: number; scale: number; fullOpacity: number; peekOpacity: number };

// Reanimated's own clamp needs its native initializers, which a plain unit test doesn't load.
function clamp(value: number, min: number, max: number) {
  "worklet";

  return Math.min(max, Math.max(min, value));
}

/**
 * The pose of a step `offset` steps from the column's position: 0 centred at full size, -1 the
 * upper peek, +1 the lower. `y` moves the step's centre from the column's; the full step is gone
 * by `HANDOVER` and its peek fades in after, so a slot never shows its text twice.
 */
export function slotPose(offset: number, column: number, peekHeight: number): SlotPose {
  "worklet";

  const away = clamp(Math.abs(offset), 0, 1);
  const beyond = clamp(Math.abs(offset) - 1, 0, 1);
  // A resting peek's inner edge sits on its slot's inner edge.
  const peekCentre = column / 2 - PEEK_SLOT + (PEEK_SCALE * peekHeight) / 2;

  return {
    y: Math.sign(offset) * (away * peekCentre + beyond * PEEK_SLOT),
    scale: 1 - away * (1 - PEEK_SCALE),
    // Eased out, so mid-page the full step is as visible as a linear fade over the whole page.
    fullOpacity: 1 - clamp(away / HANDOVER, 0, 1) ** 2,
    peekOpacity: PEEK_OPACITY * (clamp((away - HANDOVER) / (1 - HANDOVER), 0, 1) - beyond),
  };
}

/** The step a release snaps to: where the velocity carries `position`, within `reach`. */
export function settleTarget(position: number, velocity: number, reach: StepReach) {
  "worklet";

  return clamp(Math.round(position + velocity * VELOCITY_CARRY), reach.first, reach.last);
}

/** Where a spring to `to` starts, so a jump of several steps runs as one page in its direction. */
export function springStart(from: number, to: number) {
  "worklet";

  return Math.abs(to - from) > 1 ? to - Math.sign(to - from) : from;
}
