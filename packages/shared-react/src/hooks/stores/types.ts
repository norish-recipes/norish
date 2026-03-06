import type { QueryKey } from "@tanstack/react-query";

import type { AppRouter } from "@norish/trpc/client";
import type { createTRPCContext } from "@trpc/tanstack-react-query";
import type { StoreCreateDto, StoreDto, StoreUpdateInput } from "@norish/shared/contracts";

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

export type StoresMutationsResult = {
  createStore: (data: StoreCreateDto) => Promise<string>;
  updateStore: (data: StoreUpdateInput) => void;
  deleteStore: (storeId: string, deleteGroceries: boolean) => void;
  reorderStores: (storeIds: string[]) => void;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  isReordering: boolean;
};

export interface CreateStoresHooksOptions {
  useTRPC: () => TrpcHookBinding;
}
