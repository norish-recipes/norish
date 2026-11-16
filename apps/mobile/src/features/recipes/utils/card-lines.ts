/** `rows` in lines of `perLine`: a grid's pairs, or a list's single rows. */
export function cardLines<Row>(rows: Row[], perLine: number) {
  const lines: Row[][] = [];

  for (let at = 0; at < rows.length; at += perLine) lines.push(rows.slice(at, at + perLine));

  return lines;
}
