export const PEEK_SCALE = 0.86;
export const PEEK_OPACITY = 0.22;
/** The fixed height of the peek slots above and below the current step. */
export const PEEK_SLOT = 96;
/** The tallest a peek lays out: two lines of step text and the padding above them, which at
 * `PEEK_SCALE` sits inside its slot; a two-line step's chips are left out. */
export const PEEK_MAX_HEIGHT = 12 + 2 * 44;
/** The finger travel that moves the column by one step. */
export const DRAG_DISTANCE = 220;
/** Seconds of release velocity a settle carries the column on. */
export const VELOCITY_CARRY = 0.2;
/** How far out a full step is gone and its peek starts, so the two layers never show together. */
export const HANDOVER = 0.7;

/** The steps a drag from the current one can reach. */
export type StepReach = { first: number; last: number };

export function stepReach(current: number, count: number): StepReach {
  return { first: Math.max(current - 1, 0), last: Math.min(current + 1, count - 1) };
}

export type SlotPose = { y: number; scale: number; fullOpacity: number; peekOpacity: number };

// Reanimated's own clamp needs its native initializers, which a plain unit test doesn't load.
function clamp(value: number, min: number, max: number) {
  "worklet";

  return Math.min(max, Math.max(min, value));
}

export function clampToReach(position: number, reach: StepReach) {
  "worklet";

  return clamp(position, reach.first, reach.last);
}

/** Whether a touch at `y` lands on the current step rather than a peek slot. */
export function onStep(y: number, column: number) {
  "worklet";

  return y > PEEK_SLOT && y < column - PEEK_SLOT;
}

/** A step `offset` steps from the column's position: 0 centred full size, ±1 a peek. The full
 * step is gone by `HANDOVER` before its peek fades in, so a slot never shows its text twice. */
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

  return clampToReach(Math.round(position + velocity * VELOCITY_CARRY), reach);
}

/** Where a spring to `to` starts, so a jump of several steps runs as one page in its direction. */
export function springStart(from: number, to: number) {
  "worklet";

  return Math.abs(to - from) > 1 ? to - Math.sign(to - from) : from;
}
