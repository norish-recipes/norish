"use client";

import type { StoreDto } from "@/types";
import type { QueryKey } from "@tanstack/react-query";

import { useQueryClient, useQuery } from "@tanstack/react-query";

import { useTRPC } from "@/app/providers/trpc-provider";

export type StoresData = StoreDto[];

export type StoresQueryResult = {
  stores: StoreDto[];
  error: unknown;
  isLoading: boolean;
  queryKey: QueryKey;
  setStoresData: (updater: (prev: StoresData | undefined) => StoresData | undefined) => void;
  invalidate: () => void;
};

export function useStoresQuery(): StoresQueryResult {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const queryKey = trpc.stores.list.queryKey();

  const { data, error, isLoading } = useQuery(trpc.stores.list.queryOptions());

  const stores = data ?? [];

  const setStoresData = (updater: (prev: StoresData | undefined) => StoresData | undefined) => {
    queryClient.setQueryData<StoresData>(queryKey, updater);
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey });
  };

  return {
    stores,
    error,
    isLoading,
    queryKey,
    setStoresData,
    invalidate,
  };
}
