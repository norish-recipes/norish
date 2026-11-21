import type { ResolvedProductLink, StoreProductDto } from "@norish/shared/contracts";
import type { LineCost } from "@norish/shared/lib/line-cost";
import { groupLineCost } from "@norish/shared/lib/line-cost";
import { packSizeOf } from "@norish/shared/lib/pack-size";
import { isPendingLink } from "@norish/shared/lib/product-link";
import { saleRegularPrice } from "@norish/shared/lib/sale";

import type { PricedLine } from "./store-total";
import { useLinkFor } from "./use-store-prices";

/** What a row's price shows: nothing, a wait for the Store's answer, or the product and its Line Cost. */
export type GroceryPrice =
  | { status: "none" }
  | { status: "pending" }
  | {
      status: "priced";
      product: StoreProductDto;
      cost: LineCost;
      /** The regular Line Cost: the same packs at the price the shop struck through; null where this is no Sale. */
      regularCost: number | null;
    };

const NONE: GroceryPrice = { status: "none" };
const PENDING: GroceryPrice = { status: "pending" };

/** What a row costs at its Store, given what the Store knows about the row's food. */
export function priceOfLink(line: PricedLine, link: ResolvedProductLink | null): GroceryPrice {
  if (!link) return NONE;
  if (isPendingLink(link)) return PENDING;

  const product = link.product;

  if (!product) return NONE;
  const pack = packSizeOf(product);
  const regularPrice = saleRegularPrice(product.price, product.regularPrice);

  return {
    status: "priced",
    product,
    cost: groupLineCost(line.amounts, { price: product.price, pack }),
    regularCost:
      regularPrice === null
        ? null
        : groupLineCost(line.amounts, { price: regularPrice, pack }).cost,
  };
}

/** What this row costs at its Store, read off the Store's link for the row's food. */
export function useGroceryPrice(line: PricedLine): GroceryPrice {
  return priceOfLink(line, useLinkFor(line.storeId, line.ingredientId));
}
