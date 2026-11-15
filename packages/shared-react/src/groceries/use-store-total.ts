import type { PricedLine, StoreTotal } from "./store-total";
import { storeTotal } from "./store-total";
import { useStorePrices } from "./use-store-prices";

/** What is still to buy at this Store costs this, for its section heading; each list hands over
 * the rows it shows, so the heading is the sum of the prices under it. */
export function useStoreTotal(lines: PricedLine[], storeId: string | null): StoreTotal | null {
  return useStorePrices((priceFor) => storeTotal(lines, priceFor, storeId)) ?? null;
}
