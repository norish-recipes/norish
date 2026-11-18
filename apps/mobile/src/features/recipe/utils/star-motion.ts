/** How long each filling star waits after the one before it, so a rating fills left to right. */
export const STAR_STAGGER_MS = 45;

export type StarMotion = { delay: number; pop: boolean };

/** How `star` (1-5) moves when a tap takes the rating from `from` to `to` stars: the stars that
 * fill stagger from the first that changes and pop; any other star fades at once, without a pop. */
export function starMotion(star: number, from: number, to: number): StarMotion {
  const fills = star > from && star <= to;

  return { delay: fills ? (star - from - 1) * STAR_STAGGER_MS : 0, pop: fills };
}
