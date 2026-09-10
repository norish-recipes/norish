import type { IFuseOptions } from "fuse.js";
import Fuse from "fuse.js";

import { normalizeGroceryName } from "./normalized-name";

/** What a shopper has to tell two products apart by: the name, the price, the size. */
export interface DistinguishableProduct {
  name: string;
  price?: number;
  currency?: string | null;
  size?: string | null;
}

function sameness(product: DistinguishableProduct): string {
  return [
    normalizeGroceryName(product.name),
    product.price ?? "",
    product.currency ?? "",
    normalizeGroceryName(product.size),
  ].join("|");
}

/**
 * The products a shopper could tell apart, one of each. AH lists one loaf
 * under two product numbers — the same name, the same price, the same size,
 * two addresses — and a shopper offered both is being asked to choose between
 * a thing and itself. Nobody hesitates over that, so the rule below must not
 * either, and a dropdown must not show it twice. Only what is shown is
 * compared: two listings that differ in price or size are two products,
 * whatever the shop calls them.
 *
 * `prefer` names the listing that stands for its twins where one already
 * does — the product a link points at — so folding never hides the one row
 * that is picked. Otherwise the first, which is the shop's own ranking. A
 * group keeps the place of its first listing either way.
 */
export function distinctProducts<T extends DistinguishableProduct>(
  products: T[],
  prefer: (product: T) => boolean = () => false
): T[] {
  const groups = new Map<string, T>();

  for (const product of products) {
    const key = sameness(product);
    const held = groups.get(key);

    if (!held || (prefer(product) && !prefer(held))) groups.set(key, product);
  }

  return [...groups.values()];
}

/** How much longer or shorter than the grocery's name a product's may be and still be it. */
const LENGTH_SLACK = 2;

/**
 * Fuse scores a pattern found in a text from 0, the pattern itself, to 1,
 * nothing alike: the errors it took, over the pattern's length. Every name is
 * scored here and judged below, against an allowance that is the grocery
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
 * How far a name may score from the grocery's and still be the name: a slip
 * or two of the fingers — a letter typed wrong, left out or added — and never
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

/**
 * The auto-link rule, applied only where a human would not hesitate: a
 * product's normalized name is the grocery's name, to the letter, or is that
 * name typed with a slip or two of the fingers — "sneopjes" for "snoepjes".
 * A product whose name merely holds the grocery's is not it: "snoepjes" sits
 * inside "Fortuin salmiak snoepjes" and names half the sweets aisle. Anything
 * less certain leaves the grocery unpriced with an invitation to choose —
 * being quietly shown the price of the wrong thing is the one outcome worth
 * avoiding at any cost.
 *
 * A name that matches to the letter is the thing asked for, however many
 * listings carry it: a shopper who wrote the product's own name has chosen,
 * and where the shop lists that name more than once the first is taken, in
 * the shop's own order. A slip is read the same way, for the nearest name;
 * two different names equally near are two things it could be, and the
 * shopper says which.
 *
 * There is no tunable threshold on purpose: there is then no number to
 * re-guess when it misjudges.
 *
 * One rule, wherever a grocery name meets a shop's products: the lookup queue
 * asks it of what a shop just answered, and the picker asks it of the rows it
 * is about to show. Two rules would mean a shopper watching a match happen and
 * a shopper who stepped away seeing different answers.
 */
export function chooseUnmistakable<T extends DistinguishableProduct>(
  products: T[],
  groceryName: string
): T | null {
  const wanted = normalizeGroceryName(groceryName);

  if (!wanted || products.length === 0) return null;

  // One product listed twice is one product; see `distinctProducts`.
  const distinct = distinctProducts(products);
  const equal = distinct.find((product) => normalizeGroceryName(product.name) === wanted);

  if (equal) return equal;

  const allowance = slipAllowance(wanted);

  if (allowance === 0) return null;

  let nearest: { product: T; name: string; apart: number }[] = [];

  for (const product of distinct) {
    const name = normalizeGroceryName(product.name);

    if (Math.abs(name.length - wanted.length) > LENGTH_SLACK) continue;
    const apart = slipsApart(wanted, name);

    if (apart > allowance) continue;
    const held = nearest[0];

    if (!held || apart < held.apart) nearest = [{ product, name, apart }];
    else if (apart === held.apart) nearest.push({ product, name, apart });
  }

  const first = nearest[0];

  if (!first) return null;

  return nearest.every((near) => near.name === first.name) ? first.product : null;
}
