import type { CreateStoresHooksOptions } from "./types";
import { createUseStoreAisles, createUseStoreAislesSubscription } from "./use-store-aisles";
import { createUseStorePrices, createUseStorePricesSubscription } from "./use-store-prices";
import { createUseStoresCache } from "./use-stores-cache";
import { createUseStoresMutations } from "./use-stores-mutations";
import { createUseStoresQuery } from "./use-stores-query";
import { createUseStoresSubscription } from "./use-stores-subscription";

export type {
  CreateStoresHooksOptions,
  StoreGrocerySnapshot,
  StoreUpdateDraft,
  StoresCacheHelpers,
  StoresData,
  StoresMutationsResult,
  StoresQueryResult,
} from "./types";

export { createUseStoresQuery } from "./use-stores-query";
export { createUseStoresMutations } from "./use-stores-mutations";
export { createUseStoresCache } from "./use-stores-cache";
export { createUseStoresSubscription } from "./use-stores-subscription";
export {
  createUseStorePrices,
  createUseStorePricesSubscription,
  PENDING_LINK_MAX_AGE_MS,
  priceKey,
  type StorePricesResult,
} from "./use-store-prices";
export {
  aisleKey,
  createUseStoreAisles,
  createUseStoreAislesSubscription,
  mergeAisleFiling,
  type StoreAislesData,
  type StoreAislesResult,
} from "./use-store-aisles";

export function createStoresHooks({ useTRPC }: CreateStoresHooksOptions) {
  const useStoresQuery = createUseStoresQuery({ useTRPC });
  const useStoresCacheHelpers = createUseStoresCache({ useTRPC });
  const useStoresMutations = createUseStoresMutations({ useTRPC, useStoresQuery });
  const useStoresSubscription = createUseStoresSubscription({ useTRPC, useStoresCacheHelpers });
  const useStorePrices = createUseStorePrices({ useTRPC });
  const useStorePricesSubscription = createUseStorePricesSubscription({ useTRPC });
  const useStoreAisles = createUseStoreAisles({ useTRPC });
  const useStoreAislesSubscription = createUseStoreAislesSubscription({ useTRPC });

  return {
    useStoresQuery,
    useStoresMutations,
    useStoresCacheHelpers,
    useStoresSubscription,
    useStorePrices,
    useStorePricesSubscription,
    useStoreAisles,
    useStoreAislesSubscription,
  };
}
