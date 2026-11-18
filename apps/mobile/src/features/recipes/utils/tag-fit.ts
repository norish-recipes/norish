/**
 * How many of the tags, in order, fit in `room` pt on one line, `gap` apart. When some are left out
 * the `+N` chip (`moreWidth`) takes its place after the last shown, so the line never overflows.
 */
export function fitTags(widths: readonly number[], room: number, gap: number, moreWidth: number) {
  const lineOf = (count: number) =>
    widths.slice(0, count).reduce((line, width) => line + width + gap, -gap);

  if (lineOf(widths.length) <= room) return widths.length;

  for (let count = widths.length - 1; count > 0; count--) {
    if (lineOf(count) + gap + moreWidth <= room) return count;
  }

  return 0;
}
