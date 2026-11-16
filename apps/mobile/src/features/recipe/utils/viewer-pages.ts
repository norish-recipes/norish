/** How far down a drag, in points, or how fast a flick, in points a second, lets go of the viewer. */
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 900;

/** The page a horizontal scroll offset rests on; the offset of a bounce past either end clamps. */
export function pageAt(offset: number, width: number, count: number): number {
  if (width <= 0 || count <= 0) return 0;

  return Math.min(count - 1, Math.max(0, Math.round(offset / width)));
}

/** The viewer's "n / m" for the zero-based page. */
export const counterLabel = (page: number, count: number) => `${page + 1} / ${count}`;

/** Whether a downward drag or flick that just ended closes the viewer. */
export const dismisses = (translationY: number, velocityY: number) =>
  translationY > DISMISS_DISTANCE || velocityY > DISMISS_VELOCITY;
