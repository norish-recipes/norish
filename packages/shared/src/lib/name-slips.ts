import type { IFuseOptions } from "fuse.js";
import Fuse from "fuse.js";

/** How much longer or shorter than the wanted name another may be and still be it. */
const LENGTH_SLACK = 2;

/**
 * Fuse scores a pattern found in a text from 0, the pattern itself, to 1,
 * nothing alike: the errors it took, over the pattern's length. Every name is
 * scored here and judged below, against an allowance that is the wanted
 * name's own rather than one threshold for all.
 */
const SCORING: IFuseOptions<{ name: string }> = {
  keys: ["name"],
  includeScore: true,
  ignoreLocation: true,
  ignoreFieldNorm: true,
  threshold: 1,
};

/**
 * How far a name may score from the wanted one and still be it: a slip or
 * two of the fingers — a letter typed wrong, left out or added — and never
 * more than a quarter of the name. Nothing under five letters, where one
 * letter apart is a different word: "melk" is not "meel". Two swapped letters
 * are two errors to Fuse, so "sneopjes" is "snoepjes" from eight letters up.
 */
function slipAllowance(name: string): number {
  return name.length < 5 ? 0 : Math.min(0.25, 2 / name.length);
}

function scored(pattern: string, text: string): number {
  return new Fuse([{ name: text }], SCORING).search(pattern)[0]?.score ?? 1;
}

/**
 * How far apart two names are, read from both sides. Fuse finds a pattern
 * inside a text and charges nothing for what surrounds it, so "oude kaas" sits
 * inside "jonge kaas" for two errors while "jonge kaas" does not sit inside
 * "oude kaas" at all; the farther of the two readings is the honest one.
 */
function slipsApart(a: string, b: string): number {
  return Math.max(scored(a, b), scored(b, a));
}

/** An item a name may be, and how close: 1 is the name itself, a slip less. */
export interface Scored<T> {
  item: T;
  score: number;
}

/**
 * Every thing (`thingOf`) an item names that is `wanted` typed with a slip, by its nearest item,
 * best first. No tunable threshold on purpose: no number to re-guess when it misjudges.
 */
export function slipsNear<T>(
  wanted: string,
  items: readonly T[],
  nameOf: (item: T) => string,
  thingOf: (item: T) => string = nameOf
): Scored<T>[] {
  const allowance = slipAllowance(wanted);

  if (allowance === 0) return [];

  const nearest = new Map<string, Scored<T>>();

  for (const item of items) {
    const name = nameOf(item);

    if (Math.abs(name.length - wanted.length) > LENGTH_SLACK) continue;
    const apart = slipsApart(wanted, name);

    if (apart > allowance) continue;
    const thing = thingOf(item);
    const score = 1 - apart;

    if (score > (nearest.get(thing)?.score ?? -1)) nearest.set(thing, { item, score });
  }

  return [...nearest.values()].sort((a, b) => b.score - a.score);
}

/** The best of a scored list, best first; null where it is empty or two things tie for best. */
export function onlyNearest<S extends { score: number }>(scored: readonly S[]): S | null {
  const [first, second] = scored;

  return first && first.score !== second?.score ? first : null;
}

/** The nearest item whose folded name is `wanted` typed with a slip, unless two things tie. */
export function nearestSlip<T>(
  wanted: string,
  items: readonly T[],
  nameOf: (item: T) => string,
  thingOf: (item: T) => string = nameOf
): T | null {
  return onlyNearest(slipsNear(wanted, items, nameOf, thingOf))?.item ?? null;
}

/** Whether `wanted` could be some name a slip away, which is from five letters up. */
export function mayBeASlip(wanted: string): boolean {
  return slipAllowance(wanted) > 0;
}

/** The length band a slip of `wanted` lies in. */
export function slipLengths(wanted: string): { min: number; max: number } {
  return { min: wanted.length - LENGTH_SLACK, max: wanted.length + LENGTH_SLACK };
}
