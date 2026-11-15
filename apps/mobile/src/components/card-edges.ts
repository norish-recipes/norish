/** Which corners of its section's card a row rounds: the first the top, the last the bottom. */
export type Edge = { top: boolean; bottom: boolean };

/** The edge of the row at `index` among `count` rows of one card. */
export const edgeAt = (index: number, count: number): Edge => ({
  top: index === 0,
  bottom: index === count - 1,
});
