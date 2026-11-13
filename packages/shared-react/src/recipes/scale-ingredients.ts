/**
 * The lines at `toServings`, each positive amount scaled from `fromServings` and
 * rounded to four decimals; the lines themselves when nothing changes.
 */
export function scaleIngredients<T extends { amount: number | null }>(
  lines: T[],
  fromServings: number,
  toServings: number
): T[] {
  if (!(fromServings > 0) || toServings === fromServings) return lines;

  return lines.map((line) =>
    line.amount != null && line.amount > 0
      ? { ...line, amount: Math.round((line.amount / fromServings) * toServings * 10000) / 10000 }
      : line
  );
}
