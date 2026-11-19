// A full swipe is the open width plus this, so a swipe that only opens the actions never runs one.
export const FULL_SWIPE_OVERSHOOT = 64;
// Room a full swipe leaves at the screen's left edge, for a finger that starts on the card's right.
const FULL_SWIPE_EDGE = 64;

// How far back past the full swipe a finger must go to leave it, so jitter on the line ticks once.
export const FULL_SWIPE_HYSTERESIS = 16;
// The least a full swipe goes past the open width, however little room the card leaves.
export const FULL_SWIPE_FLOOR = 32;

/** How far right of its place action `index` of `count` sits with the card `travel` pt over a
 * `width` pt panel: each moves at `(count - index) / count` of the finger, as one under Reduce Motion.
 * `step` is the gap between neighbours' places. */
export function actionOffset(
  travel: number,
  width: number,
  index: number,
  count: number,
  step: number,
  reduceMotion: boolean
) {
  "worklet";

  // Past the open width the outermost action, the one a full swipe runs, closes on the card's edge.
  if (travel > width) {
    if (reduceMotion) return width - travel;
    if (index !== count - 1) return 0;

    return width - travel - step * index * dropAway(travel, width);
  }

  const left = 1 - Math.max(travel / width, 0);
  const rate = reduceMotion ? 1 : (count - index) / count;

  return width * left * rate;
}

/** 0 to 1 over the overshoot past the open width: the other actions shrink and fade as it grows. */
export function dropAway(travel: number, width: number) {
  "worklet";

  return Math.min(Math.max((travel - width) / FULL_SWIPE_OVERSHOOT, 0), 1);
}

/** The action a full swipe runs: the outermost, the last of `actions`. */
export function fullSwipeAction<T>(actions: T[]): T | undefined {
  return actions[actions.length - 1];
}

/** The drag a full swipe needs: the open width plus an overshoot, capped by the travel a card whose
 * right edge is at `rightEdge` pt allows, but always `FULL_SWIPE_FLOOR` past the open width. */
export function fullSwipeAt(openWidth: number, rightEdge: number) {
  "worklet";

  const reachable = Math.min(openWidth + FULL_SWIPE_OVERSHOOT, rightEdge - FULL_SWIPE_EDGE);

  return Math.max(reachable, openWidth + FULL_SWIPE_FLOOR);
}

export type SwipeZone = "closed" | "open" | "full";

/** Where a card dragged `travel` pt is: `closed`, `open` on release, or `full`, running the outermost
 * action. A card `was` full stays so until `FULL_SWIPE_HYSTERESIS` back past `fullAt`. */
export function swipeZone(
  travel: number,
  openAt: number,
  fullAt: number,
  was: SwipeZone = "closed"
): SwipeZone {
  "worklet";

  const leaveAt = was === "full" ? fullAt - FULL_SWIPE_HYSTERESIS : fullAt;

  return travel > leaveAt ? "full" : travel > openAt ? "open" : "closed";
}
