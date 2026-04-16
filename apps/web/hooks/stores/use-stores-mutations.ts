"use client";

import { sharedStoresHooks } from "./shared-stores-hooks";

export const useStoresMutations = sharedStoresHooks.useStoresMutations;

export type {
  StoreGrocerySnapshot,
  StoresMutationsResult,
  StoreUpdateDraft,
} from "@norish/shared-react/hooks";
