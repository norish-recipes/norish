import type { GroceryDto, StoreProductDto } from "@norish/shared/contracts";
import type { GroceryGroup } from "@norish/shared/lib/grocery-grouping";
import type { LineAmount, LineCost } from "@norish/shared/lib/line-cost";
import { groupLineCost } from "@norish/shared/lib/line-cost";
import { packSizeOf } from "@norish/shared/lib/pack-size";

/** One row as priced: the Store and Ingredient its Product Link is keyed by (ADR-0037), its name,
 * and its amounts, one for a grocery, one per source for a group priced as one purchase. */
export interface PricedLine {
  storeId: string | null;
  /** None yet on a line added offline, which is unpriced until it is resolved. */
  ingredientId?: string | null;
  name: string | null;
  isDone: boolean;
  amounts: LineAmount[];
}

export function lineOf(grocery: GroceryDto): PricedLine {
  return {
    storeId: grocery.storeId ?? null,
    ingredientId: grocery.ingredientId ?? null,
    name: grocery.name,
    isDone: grocery.isDone,
    amounts: [
      { amount: grocery.amount, unit: grocery.unit, purchaseAmount: grocery.purchaseAmount },
    ],
  };
}

/** A group shares one name at one Store, so its first source's link prices it, and its amounts
 * are all its sources', because the row shows all of them. */
export function lineOfGroup(group: GroceryGroup): PricedLine {
  const first = group.sources[0];

  if (!first) throw new Error("A grocery group has no groceries");

  return {
    storeId: group.storeId,
    ingredientId: first.grocery.ingredientId ?? null,
    name: first.grocery.name,
    isDone: group.allDone,
    amounts: group.sources.map((source) => ({
      amount: source.grocery.amount,
      purchaseAmount: source.grocery.purchaseAmount,
      unit: source.grocery.unit,
    })),
  };
}

type PriceFor = (
  storeId: string | null,
  ingredientId: string | null | undefined
) => StoreProductDto | null;

/** What a row costs at its Store, and the product that prices it; null where the Store cannot price it. */
function priceLine(
  line: PricedLine,
  priceFor: PriceFor
): (LineCost & { product: StoreProductDto }) | null {
  const product = priceFor(line.storeId, line.ingredientId);

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

/** The Line Costs of a Store's outstanding rows summed, so a heading is the sum under it; an
 * unpriced line is left out, and the total is in its first priced line's currency only. */
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
