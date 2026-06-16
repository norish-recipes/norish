import type { ReactNode } from "react";
import { createContext, createElement, useContext, useMemo, useState } from "react";

import type { StoreCreateDto, StoreDto } from "@norish/shared/contracts";

import type {
  StoreGrocerySnapshot,
  StoresMutationsResult,
  StoresQueryResult,
  StoreUpdateDraft,
} from "../../hooks/stores";

export type StoresContextValue = {
  // Data
  stores: StoreDto[];
  isLoading: boolean;
  createStore: (data: StoreCreateDto) => Promise<string>;
  updateStore: (data: StoreUpdateDraft) => void;
  deleteStore: (
    storeId: string,
    deleteGroceries: boolean,
    grocerySnapshot: StoreGrocerySnapshot
  ) => void;
  reorderStores: (storeIds: string[]) => void;
  // UI
  storeManagerOpen: boolean;
  setStoreManagerOpen: (open: boolean) => void;
};

type CreateStoresContextOptions = {
  useStoresQuery: () => StoresQueryResult;
  useStoresMutations: () => StoresMutationsResult;
  useStoresSubscription: () => void;
};

export function createStoresContext({
  useStoresQuery,
  useStoresMutations,
  useStoresSubscription,
}: CreateStoresContextOptions) {
  const StoresContext = createContext<StoresContextValue | null>(null);

  function StoresContextProvider({ children }: { children: ReactNode }) {
    // Data hooks
    const { stores, isLoading } = useStoresQuery();
    const storeMutations = useStoresMutations();

    // Subscribe to WebSocket events (updates query cache via internal cache helpers)
    useStoresSubscription();

    // UI State
    const [storeManagerOpen, setStoreManagerOpen] = useState(false);

    const value = useMemo<StoresContextValue>(
      () => ({
        stores,
        isLoading,
        ...storeMutations,
        storeManagerOpen,
        setStoreManagerOpen,
      }),
      [stores, isLoading, storeMutations, storeManagerOpen]
    );

    return createElement(StoresContext.Provider, { value }, children);
  }

  function useStoresContext() {
    const ctx = useContext(StoresContext);

    if (!ctx) throw new Error("useStoresContext must be used within StoresContextProvider");

    return ctx;
  }

  return {
    StoresContextProvider,
    useStoresContext,
  };
}
