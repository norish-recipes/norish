"use client";

import type { StoreDto, StoreCreateDto, StoreUpdateInput } from "@/types";

import { createContext, useContext, ReactNode, useMemo, useState } from "react";

import { useStoresQuery, useStoresMutations, useStoresSubscription } from "@/hooks/stores";

type StoresCtx = {
  // Data
  stores: StoreDto[];
  isLoading: boolean;
  createStore: (data: StoreCreateDto) => Promise<string>;
  updateStore: (data: StoreUpdateInput) => void;
  deleteStore: (storeId: string, deleteGroceries: boolean) => void;
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
