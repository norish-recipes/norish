/** How much longer or shorter than the wanted name another may be and still be it. */
const LENGTH_SLACK = 1;

/** Nothing under five letters, where one letter apart is a different word: "melk" is not "meel". */
const SHORTEST_SLIP = 5;

/**
 * Whether two names are one slip of the fingers apart: a letter typed wrong, left out or added, or
 * two neighbours swapped ("sneopjes"). Never the first letter, so "wraps" is not "raps".
 */
function oneSlipApart(a: string, b: string): boolean {
  if (a === b || a[0] !== b[0] || Math.abs(a.length - b.length) > LENGTH_SLACK) return false;
  let at = 0;

  while (a[at] === b[at]) at += 1;

  if (a.length !== b.length) {
    const [longer, shorter] = a.length > b.length ? [a, b] : [b, a];

    return longer.slice(at + 1) === shorter.slice(at);
  }

  return (
    a.slice(at + 1) === b.slice(at + 1) ||
    (a[at] === b[at + 1] && a[at + 1] === b[at] && a.slice(at + 2) === b.slice(at + 2))
  );
}

/** An item a name may be, and how close: 1 is the name itself, a slip less. */
export interface Scored<T> {
  item: T;
  score: number;
}

/**
 * Every thing (`thingOf`) an item names that is `wanted` typed with a slip, by its first item. No
 * tunable threshold on purpose: one slip, never two, so there is no number to re-guess.
 */
export function slipsNear<T>(
  wanted: string,
  items: readonly T[],
  nameOf: (item: T) => string,
  thingOf: (item: T) => string = nameOf
): Scored<T>[] {
  if (!mayBeASlip(wanted)) return [];

  const score = 1 - 1 / wanted.length;
  const near = new Map<string, Scored<T>>();

  for (const item of items) {
    const thing = thingOf(item);

    if (!near.has(thing) && oneSlipApart(wanted, nameOf(item))) near.set(thing, { item, score });
  }

  return [...near.values()];
}

/** The best of a scored list, best first; null where it is empty or two things tie for best. */
export function onlyNearest<S extends { score: number }>(scored: readonly S[]): S | null {
  const [first, second] = scored;

  return first && first.score !== second?.score ? first : null;
}

/** The item whose folded name is `wanted` typed with a slip, unless two things are. */
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
  return wanted.length >= SHORTEST_SLIP;
}

/** The length band a slip of `wanted` lies in. */
export function slipLengths(wanted: string): { min: number; max: number } {
  return { min: wanted.length - LENGTH_SLACK, max: wanted.length + LENGTH_SLACK };
}
