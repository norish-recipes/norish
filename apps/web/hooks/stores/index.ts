"use client";

import { sharedStoresHooks } from "./shared-stores-hooks";

export const useStoresQuery = sharedStoresHooks.useStoresQuery;
export type { StoresQueryResult, StoresData } from "@norish/shared-react/hooks";

export const useStoresMutations = sharedStoresHooks.useStoresMutations;
export type { StoresMutationsResult } from "@norish/shared-react/hooks";

export const useStoresSubscription = sharedStoresHooks.useStoresSubscription;

export const useStoresCacheHelpers = sharedStoresHooks.useStoresCacheHelpers;
export type { StoresCacheHelpers } from "@norish/shared-react/hooks";
