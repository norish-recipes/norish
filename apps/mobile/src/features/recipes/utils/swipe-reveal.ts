// A full swipe is the open width plus this, so a swipe that only opens the actions never runs one.
export const FULL_SWIPE_OVERSHOOT = 64;
// Room a full swipe leaves at the screen's left edge, for a finger that starts on the card's right.
const FULL_SWIPE_EDGE = 64;
// How far back past the full swipe a finger must go to leave it, so jitter on the line ticks once.
export const FULL_SWIPE_HYSTERESIS = 16;
// The least a full swipe goes past the open width, however little room the card leaves.
export const FULL_SWIPE_FLOOR = 32;

/** How far right of its place action `index` of `count` sits with the card `travel` pt over a
 * `width` pt panel: each moves at `(count - index) / count` of the finger, as one under Reduce Motion. */
export function actionOffset(
  travel: number,
  width: number,
  index: number,
  count: number,
  reduceMotion: boolean
) {
  "worklet";

  // Past the open width the first action, the one a full swipe runs, follows the card's edge.
  if (travel > width) return index === 0 || reduceMotion ? width - travel : 0;

  const left = 1 - Math.max(travel / width, 0);
  const rate = reduceMotion ? 1 : (count - index) / count;

  return width * left * rate;
}

/** The drag a full swipe needs: the open width plus an overshoot, capped by the travel a card whose
 * right edge is at `rightEdge` pt allows, but always `FULL_SWIPE_FLOOR` past the open width. */
export function fullSwipeAt(openWidth: number, rightEdge: number) {
  "worklet";

  const reachable = Math.min(openWidth + FULL_SWIPE_OVERSHOOT, rightEdge - FULL_SWIPE_EDGE);

  return Math.max(reachable, openWidth + FULL_SWIPE_FLOOR);
}

export type SwipeZone = "closed" | "open" | "full";

/** Where a card dragged `travel` pt is: `closed`, `open` on release, or `full`, running the first
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
