import type { ReactNode } from "react";
import { createContext, createElement, useContext, useMemo, useState } from "react";

import type {
  ResolvedProductLink,
  StoreCreateDto,
  StoreDto,
  StoreProductDto,
  StoreSearchAddressResult,
} from "@norish/shared/contracts";

import type {
  StoreAislesResult,
  StoreGrocerySnapshot,
  StorePricesResult,
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
  checkSearchAddress: (
    storeId: string,
    term: string | null,
    searchAddress: string | null,
    website: string | null
  ) => Promise<StoreSearchAddressResult>;
  /** File a grocery name at a Store under one of its aisles, or under none, which forgets it. */
  fileName: (storeId: string, name: string, aisleId: string | null) => void;
  // Prices
  /** The Store Product a grocery resolves to, or null where its Store answered with a Miss. */
  priceFor: (storeId: string | null, name: string | null) => StoreProductDto | null;
  /** What its Store knows about the name: a link, a Miss, a Pending Link, or nothing. */
  linkFor: (storeId: string | null, name: string | null) => ResolvedProductLink | null;
  // Aisles
  /** The aisle a Store files a name under, or null where it has never been told (ADR-0031). */
  aisleFor: (storeId: string | null, name: string | null) => string | null;
  // UI
  storeManagerOpen: boolean;
  setStoreManagerOpen: (open: boolean) => void;
};

type CreateStoresContextOptions = {
  useStoresQuery: () => StoresQueryResult;
  useStoresMutations: () => StoresMutationsResult;
  useStoresSubscription: () => void;
  /** Prices are a web surface for now; a client that has none passes neither. */
  useStorePrices?: () => StorePricesResult;
  useStorePricesSubscription?: () => void;
  /** Aisles too: a client that ignores them files nothing and shows one flat list. */
  useStoreAisles?: () => StoreAislesResult;
  useStoreAislesSubscription?: () => void;
};

const useNoPrices = (): StorePricesResult => ({
  priceFor: () => null,
  linkFor: () => null,
  isLoading: false,
});
const useNoPricesSubscription = () => undefined;
const useNoAisles = (): StoreAislesResult => ({ aisleFor: () => null, isLoading: false });
const useNoAislesSubscription = () => undefined;

export function createStoresContext({
  useStoresQuery,
  useStoresMutations,
  useStoresSubscription,
  useStorePrices = useNoPrices,
  useStorePricesSubscription = useNoPricesSubscription,
  useStoreAisles = useNoAisles,
  useStoreAislesSubscription = useNoAislesSubscription,
}: CreateStoresContextOptions) {
  const StoresContext = createContext<StoresContextValue | null>(null);

  function StoresContextProvider({ children }: { children: ReactNode }) {
    // Data hooks
    const { stores, isLoading } = useStoresQuery();
    const storeMutations = useStoresMutations();

    // Subscribe to WebSocket events (updates query cache via internal cache helpers)
    useStoresSubscription();

    // A price a housemate just linked lands here without a reload.
    const { priceFor, linkFor } = useStorePrices();

    useStorePricesSubscription();

    // Where each Store files each name, and a housemate's filing as it lands.
    const { aisleFor } = useStoreAisles();

    useStoreAislesSubscription();

    // UI State
    const [storeManagerOpen, setStoreManagerOpen] = useState(false);

    const value = useMemo<StoresContextValue>(
      () => ({
        stores,
        isLoading,
        ...storeMutations,
        priceFor,
        linkFor,
        aisleFor,
        storeManagerOpen,
        setStoreManagerOpen,
      }),
      [stores, isLoading, storeMutations, priceFor, linkFor, aisleFor, storeManagerOpen]
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
