/** A swipe past this share of the screen's width, released, runs the first action: a share of a
 * grid card's own width would be an accident away. */
export const FULL_SWIPE_SHARE = 0.8;

/**
 * How far right of its place action `index` of `count` sits when the card is `travel` pt along its
 * way over a `width` pt panel. The first action is glued to the card's edge; each next one moves at
 * a smaller share of the finger (`(count - index) / count`), lags behind it, and lands with the
 * rest at `travel` = `width`. With `reduceMotion` they move as one block.
 */
export function actionOffset(
  travel: number,
  width: number,
  index: number,
  count: number,
  reduceMotion: boolean
) {
  "worklet";

  const left = 1 - Math.min(Math.max(travel / width, 0), 1);
  const rate = reduceMotion ? 1 : (count - index) / count;

  return width * left * rate;
}

/** Whether a card dragged `travel` pt on a `screenWidth` pt screen is swiped through to the end. */
export function isFullSwipe(travel: number, screenWidth: number) {
  "worklet";

  return screenWidth > 0 && travel > screenWidth * FULL_SWIPE_SHARE;
}
