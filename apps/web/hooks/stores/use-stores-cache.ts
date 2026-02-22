"use client";

/**
 * Lightweight cache manipulation helpers for stores.
 *
 * This hook provides functions to update the React Query cache WITHOUT
 * creating query observers. Use this in subscription hooks to avoid
 * duplicate hook trees that cause recursion issues.
 *
 * For reading data + cache manipulation, use useStoresQuery instead.
 */

import type { StoresData } from "./use-stores-query";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { useTRPC } from "@/app/providers/trpc-provider";

export type StoresCacheHelpers = {
  setStoresData: (updater: (prev: StoresData | undefined) => StoresData | undefined) => void;
  invalidate: () => void;
};

/**
 * Returns cache manipulation helpers without creating query observers.
 * Safe to call from subscription hooks - won't cause recursion.
 */
export function useStoresCacheHelpers(): StoresCacheHelpers {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const queryKey = trpc.stores.list.queryKey();

  const setStoresData = useCallback(
    (updater: (prev: StoresData | undefined) => StoresData | undefined) => {
      queryClient.setQueryData<StoresData>(queryKey, updater);
    },
    [queryClient, queryKey]
  );

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  return {
    setStoresData,
    invalidate,
  };
}
