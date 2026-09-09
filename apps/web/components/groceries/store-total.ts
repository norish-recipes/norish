import type { GroceryDto, StoreProductDto } from "@norish/shared/contracts";
import type { GroceryGroup } from "@norish/shared/lib/grocery-grouping";
import type { LineAmount, LineCost } from "@norish/shared/lib/line-cost";
import { groupLineCost } from "@norish/shared/lib/line-cost";
import { packSizeOf } from "@norish/shared/lib/pack-size";

/**
 * One row of a list, as it is priced: the Store and name its Product Link
 * is keyed by, and the amounts the row stands for — one for a plain grocery,
 * one per source for a group, which is priced as one purchase.
 */
export interface PricedLine {
  storeId: string | null;
  name: string | null;
  isDone: boolean;
  amounts: LineAmount[];
}

export function lineOf(grocery: GroceryDto): PricedLine {
  return {
    storeId: grocery.storeId ?? null,
    name: grocery.name,
    isDone: grocery.isDone,
    amounts: [
      { amount: grocery.amount, unit: grocery.unit, purchaseAmount: grocery.purchaseAmount },
    ],
  };
}

/**
 * A group shares one name at one Store, so one product prices it — the
 * link of its first source, which is every source's link — and its amounts
 * are all its sources', because the row shows all of them.
 */
export function lineOfGroup(group: GroceryGroup): PricedLine {
  const first = group.sources[0];

  if (!first) throw new Error("A grocery group has no groceries");

  return {
    storeId: group.storeId,
    name: first.grocery.name,
    isDone: group.allDone,
    amounts: group.sources.map((source) => ({
      amount: source.grocery.amount,
      purchaseAmount: source.grocery.purchaseAmount,
      unit: source.grocery.unit,
    })),
  };
}

export type PriceFor = (storeId: string | null, name: string | null) => StoreProductDto | null;

/** What a row costs at its Store, and the product that prices it; null where the Store cannot price it. */
export function priceLine(
  line: PricedLine,
  priceFor: PriceFor
): (LineCost & { product: StoreProductDto }) | null {
  const product = priceFor(line.storeId, line.name);

  if (!product) return null;

  return {
    ...groupLineCost(line.amounts, { price: product.price, pack: packSizeOf(product) }),
    product,
  };
}

export interface StoreTotal {
  amount: number;
  currency: string;
}

/**
 * What is still to buy at one Store costs this, as the Store last knew: the
 * Line Costs of the outstanding rows added up. The lines are the rows a
 * section shows — in the grouped list one per group — so the heading is
 * always the sum of the prices under it.
 *
 * A line the Store cannot price is left out rather than guessed at, and a
 * Store whose products are priced in more than one currency totals the one its
 * first priced line is in — a shop charges in its own money, and a total in
 * two of them would be a lie either way.
 */
export function storeTotal(
  lines: PricedLine[],
  priceFor: PriceFor,
  storeId: string | null
): StoreTotal | null {
  if (!storeId) return null;
  const priced = lines
    .filter((line) => !line.isDone)
    .map((line) => priceLine({ ...line, storeId }, priceFor))
    .filter((line) => line !== null);

  if (priced.length === 0) return null;
  const currency = priced[0]?.product.currency ?? "";
  const same = priced.filter((line) => line.product.currency === currency);

  return {
    // Money, added up as money: two Line Costs are two exact amounts, and
    // floating point makes 1.99 + 1.29 into 3.2800000000000002.
    amount: same.reduce((sum, line) => Math.round((sum + line.cost) * 100) / 100, 0),
    currency,
  };
}
