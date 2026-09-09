import { nameWords, normalizeGroceryName } from "./normalized-name";

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

/**
 * The auto-link rule, applied only where a human would not hesitate: a
 * product's normalized name is the grocery's name, to the letter, or every
 * word of the grocery's name appears in exactly one product's name. Anything
 * less certain leaves the grocery unpriced with an invitation to choose —
 * being quietly shown the price of the wrong thing is the one outcome worth
 * avoiding at any cost.
 *
 * A name that matches to the letter is the thing asked for, however many
 * listings carry it: a shopper who wrote the product's own name has chosen,
 * and where the shop lists that name more than once the first is taken, in
 * the shop's own order. Only the looser branch has to be unique — "melk" that
 * sits inside two names has named neither.
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

  const words = nameWords(wanted);

  if (words.length === 0) return null;
  const containing = distinct.filter((product) => {
    const has = new Set(nameWords(product.name));

    return words.every((word) => has.has(word));
  });

  return containing.length === 1 ? (containing[0] ?? null) : null;
}
