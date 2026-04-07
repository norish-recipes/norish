"use client";

import type { StoreGrocerySnapshot, StoreUpdateDraft } from "@/hooks/stores";
import { createContext, ReactNode, useContext, useMemo, useState } from "react";
import { useStoresMutations, useStoresQuery, useStoresSubscription } from "@/hooks/stores";

import type { StoreCreateDto, StoreDto } from "@norish/shared/contracts";

type StoresCtx = {
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

const StoresContext = createContext<StoresCtx | null>(null);

export function StoresContextProvider({ children }: { children: ReactNode }) {
  // Data hooks
  const { stores, isLoading } = useStoresQuery();
  const storeMutations = useStoresMutations();

  // Subscribe to WebSocket events (updates query cache via internal cache helpers)
  useStoresSubscription();

  // UI State
  const [storeManagerOpen, setStoreManagerOpen] = useState(false);

  const value = useMemo<StoresCtx>(
    () => ({
      stores,
      isLoading,
      ...storeMutations,
      storeManagerOpen,
      setStoreManagerOpen,
    }),
    [stores, isLoading, storeMutations, storeManagerOpen]
  );

  return <StoresContext.Provider value={value}>{children}</StoresContext.Provider>;
}

export function useStoresContext() {
  const ctx = useContext(StoresContext);

  if (!ctx) throw new Error("useStoresContext must be used within StoresContextProvider");

  return ctx;
}
