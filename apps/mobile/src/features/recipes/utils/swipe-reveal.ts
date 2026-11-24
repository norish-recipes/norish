// A full swipe is the open width plus this, so a swipe that only opens the actions never runs one.
export const FULL_SWIPE_OVERSHOOT = 64;
// Room a full swipe leaves at the screen's left edge, for a finger that starts on the card's right.
const FULL_SWIPE_EDGE = 64;

// How far back past the full swipe a finger must go to leave it, so jitter on the line ticks once.
export const FULL_SWIPE_HYSTERESIS = 16;
// The least a full swipe goes past the open width, however little room the card leaves.
export const FULL_SWIPE_FLOOR = 32;

/** The panel's geometry: open `width`, `count` actions `step` pt apart, and the commit point `fullAt`. */
export type Reveal = { width: number; count: number; step: number; fullAt: number };

// Above capsuleStretch: a worklet captures what it calls as it is defined, so callees go first.
/** 0 to 1 from the open width to the commit point: the other actions shrink and fade as it grows. */
export function dropAway(travel: number, { width, fullAt }: Reveal) {
  "worklet";

  return Math.min(Math.max((travel - width) / (fullAt - width), 0), 1);
}

/** How far right of its place action `index` sits with the card `travel` pt over the panel: each moves
 * at `(count - index) / count` of the finger, as one under Reduce Motion. */
export function actionOffset(travel: number, reveal: Reveal, index: number, reduceMotion: boolean) {
  "worklet";

  const { width, count } = reveal;

  // Past the open width the actions stay put: the outermost stretches instead (`capsuleStretch`).
  if (travel > width) return reduceMotion ? width - travel : 0;

  const left = 1 - Math.max(travel / width, 0);
  const rate = reduceMotion ? 1 : (count - index) / count;

  return width * left * rate;
}

/** How far left the outermost circle stretches into a red capsule with the card `travel` pt over: it
 * takes the other actions' room by the commit point, then follows the card's edge, at most `reach`. */
export function capsuleStretch(travel: number, reveal: Reveal, reach: number) {
  "worklet";

  if (travel <= reveal.width) return 0;
  const room = reveal.step * (reveal.count - 1) * dropAway(travel, reveal);

  return Math.min(travel - reveal.width + room, reach);
}

/** A collapsing row's height; unset otherwise, so a recycled cell drops the last one set on its view. */
export function collapseHeight(collapses: boolean, height: number, collapse: number) {
  "worklet";

  return collapses ? height * (1 - collapse) : undefined;
}

/** How far a deleted card has travelled: from rest, or from the full swipe it was `held` at (0 to 1),
 * to `slideBy` as `slide` (0 to 1) runs. */
export function cardTravel(held: number, slide: number, fullAt: number, slideBy: number) {
  "worklet";

  const from = fullAt * held;

  return from + slide * (slideBy - from);
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
