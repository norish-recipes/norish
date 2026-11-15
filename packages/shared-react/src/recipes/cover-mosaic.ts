/** The cover mosaic as columns of photo indexes: one whole, two side by side, three as one tall and two stacked, four in a grid. */
export function coverMosaicColumns(count: number): number[][] {
  if (count >= 4)
    return [
      [0, 2],
      [1, 3],
    ];
  if (count === 3) return [[0], [1, 2]];

  return Array.from({ length: count }, (_, index) => [index]);
}
