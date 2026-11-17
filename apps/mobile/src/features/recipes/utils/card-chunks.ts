/** `rows` in runs of `size`: the list's cells, so a grid's cards share a parent they can reorder in. */
export function cardChunks<Row>(rows: Row[], size: number) {
  const chunks: Row[][] = [];

  for (let at = 0; at < rows.length; at += size) chunks.push(rows.slice(at, at + size));

  return chunks;
}
