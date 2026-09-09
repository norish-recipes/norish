import type { QueryKey } from "@tanstack/react-query";
import type { createTRPCContext } from "@trpc/tanstack-react-query";

import type {
  StoreCreateDto,
  StoreDto,
  StoreSearchAddressResult,
  StoreUpdateInput,
} from "@norish/shared/contracts";
import type { AppRouter } from "@norish/trpc/client";

type TrpcContext = ReturnType<typeof createTRPCContext<AppRouter>>;
export type TrpcHookBinding = ReturnType<TrpcContext["useTRPC"]>;

export type StoresData = StoreDto[];

export type StoresQueryResult = {
  stores: StoreDto[];
  error: unknown;
  isLoading: boolean;
  queryKey: QueryKey;
  setStoresData: (updater: (prev: StoresData | undefined) => StoresData | undefined) => void;
  invalidate: () => void;
};

export type StoresCacheHelpers = {
  setStoresData: (updater: (prev: StoresData | undefined) => StoresData | undefined) => void;
  invalidate: () => void;
};

export type StoreUpdateDraft = Omit<StoreUpdateInput, "version">;
export type StoreGrocerySnapshot = Array<{ id: string; version: number }>;

export type StoresMutationsResult = {
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
  /** File a grocery name at a Store under one of its aisles, or under none (null), which forgets it. */
  fileGroceryName: (storeId: string, name: string, aisleId: string | null) => void;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  isReordering: boolean;
};

export interface CreateStoresHooksOptions {
  useTRPC: () => TrpcHookBinding;
}
