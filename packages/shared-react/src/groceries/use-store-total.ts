import type { PricedLine, StoreTotal } from "./store-total";
import { storeTotal } from "./store-total";
import { useStorePrices } from "./use-store-prices";

/**
 * What is still to buy at this Store costs this, for the heading of the
 * section the shopper is standing in front of. Both the flat and the grouped
 * list ask, and each hands over exactly the rows it shows, so the heading is
 * always the sum of the prices under it.
 */
export function useStoreTotal(lines: PricedLine[], storeId: string | null): StoreTotal | null {
  return useStorePrices((priceFor) => storeTotal(lines, priceFor, storeId)) ?? null;
}
