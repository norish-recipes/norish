"use client";

import { sharedStoresHooks } from "./shared-stores-hooks";
import { useStoresMutations } from "./use-stores-mutations";

export const useStoreAisles = sharedStoresHooks.useStoreAisles;
export const useStoreAislesSubscription = sharedStoresHooks.useStoreAislesSubscription;

/** File a grocery name at a Store: the one write behind the panel's Aisle field and a drop into an aisle. */
export function useFileGroceryName() {
  return useStoresMutations().fileGroceryName;
}

export type { StoreAislesResult } from "@norish/shared-react/hooks";
