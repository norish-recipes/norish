/** How many tags, in order, fit in `room` pt on one line `gap` apart, and whether `+N` (`moreWidth`)
 * follows; a first tag too wide for the line is cut to `firstWidth`. */
export function fitTags(
  widths: readonly number[],
  room: number,
  gap: number,
  moreWidth: number
): { shown: number; more: boolean; firstWidth?: number } {
  const lineOf = (count: number) =>
    widths.slice(0, count).reduce((line, width) => line + width + gap, -gap);

  if (lineOf(widths.length) <= room) return { shown: widths.length, more: false };

  for (let count = widths.length - 1; count > 0; count--) {
    if (lineOf(count) + gap + moreWidth <= room) return { shown: count, more: true };
  }

  // The first tag, cut short: beside +N while that leaves it at least as wide as +N, else alone.
  const beside = room - gap - moreWidth;

  return widths.length > 1 && beside >= moreWidth
    ? { shown: 1, more: true, firstWidth: beside }
    : { shown: 1, more: false, firstWidth: room };
}
