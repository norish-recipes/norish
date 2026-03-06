import type { CreateStoresHooksOptions } from "./types";

export type {
  CreateStoresHooksOptions,
  StoresCacheHelpers,
  StoresData,
  StoresMutationsResult,
  StoresQueryResult,
} from "./types";

export { createUseStoresQuery } from "./use-stores-query";
export { createUseStoresMutations } from "./use-stores-mutations";
export { createUseStoresCache } from "./use-stores-cache";
export { createUseStoresSubscription } from "./use-stores-subscription";

import { createUseStoresQuery } from "./use-stores-query";
import { createUseStoresMutations } from "./use-stores-mutations";
import { createUseStoresCache } from "./use-stores-cache";
import { createUseStoresSubscription } from "./use-stores-subscription";

export function createStoresHooks({ useTRPC }: CreateStoresHooksOptions) {
  const useStoresQuery = createUseStoresQuery({ useTRPC });
  const useStoresCacheHelpers = createUseStoresCache({ useTRPC });
  const useStoresMutations = createUseStoresMutations({ useTRPC, useStoresQuery });
  const useStoresSubscription = createUseStoresSubscription({ useTRPC, useStoresCacheHelpers });

  return {
    useStoresQuery,
    useStoresMutations,
    useStoresCacheHelpers,
    useStoresSubscription,
  };
}
