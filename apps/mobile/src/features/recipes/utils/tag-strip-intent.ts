/** How far a finger travels, in pt, before the strip decides whether the drag is its own. */
export const STRIP_SLOP = 8;

/**
 * Who a drag that began on the tag strip belongs to, once it has travelled `STRIP_SLOP`: the strip
 * when it moves sideways and the strip can scroll that way (`scrollX` of `max`), else the card's
 * swipe or, for a vertical drag, the list. `wait` until the finger has moved far enough.
 */
export function stripIntent(dx: number, dy: number, scrollX: number, max: number) {
  "worklet";

  if (Math.hypot(dx, dy) < STRIP_SLOP) return "wait";
  if (Math.abs(dy) >= Math.abs(dx)) return "pass";

  // A finger moving left carries the content left: it reveals what is to the right.
  const canScroll = dx < 0 ? scrollX < max : scrollX > 0;

  return canScroll ? "scroll" : "pass";
}
