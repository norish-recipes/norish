import { createStoresHooks } from "@norish/shared-react/hooks";

import { useTRPC } from "@/providers/trpc-provider";

export const sharedStoresHooks = createStoresHooks({ useTRPC });

export const useStoresQuery = sharedStoresHooks.useStoresQuery;
export const useStoresMutations = sharedStoresHooks.useStoresMutations;
export const useStoresCacheHelpers = sharedStoresHooks.useStoresCacheHelpers;
export const useStoresSubscription = sharedStoresHooks.useStoresSubscription;
