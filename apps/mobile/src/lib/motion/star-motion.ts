/** How long each filling star waits after the one before it, so a rating fills left to right. */
export const STAR_STAGGER_MS = 45;

export type StarMotion = { delay: number; pop: boolean };

/** How `star` (1-5) moves when a tap takes the rating from `from` to `to` stars: the stars that
 * fill stagger from the first that changes and pop; any other star fades at once, without a pop. */
export function starMotion(star: number, from: number, to: number): StarMotion {
  const fills = star > from && star <= to;

  return { delay: fills ? (star - from - 1) * STAR_STAGGER_MS : 0, pop: fills };
}

/** A tap from `from` to `to` stars; `reached` once the stars show `to`. */
export type StarTap = { from: number; to: number; reached: boolean };

/** The tap as of the stars showing `shown`: it waits for its own value, animates on it, and the
 * next value after spends it, so later ratings show as they arrive. */
export function liveTap(tap: StarTap | null, shown: number): StarTap | null {
  if (!tap) return null;
  if (shown === tap.to) return tap.reached ? tap : { ...tap, reached: true };

  return tap.reached ? null : tap;
}
