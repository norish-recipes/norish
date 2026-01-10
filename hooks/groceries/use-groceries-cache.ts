"use client";

/**
 * Lightweight cache manipulation helpers for groceries.
 *
 * This hook provides functions to update the React Query cache WITHOUT
 * creating query observers. Use this in subscription hooks to avoid
 * duplicate hook trees that cause recursion issues.
 *
 * For reading data + cache manipulation, use useGroceriesQuery instead.
 */

import type { GroceriesData } from "./use-groceries-query";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { useTRPC } from "@/app/providers/trpc-provider";

export type GroceriesCacheHelpers = {
  setGroceriesData: (
    updater: (prev: GroceriesData | undefined) => GroceriesData | undefined
  ) => void;
  invalidate: () => void;
};

/**
 * Returns cache manipulation helpers without creating query observers.
 * Safe to call from subscription hooks - won't cause recursion.
 */
export function useGroceriesCacheHelpers(): GroceriesCacheHelpers {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const queryKey = trpc.groceries.list.queryKey();

  const setGroceriesData = useCallback(
    (updater: (prev: GroceriesData | undefined) => GroceriesData | undefined) => {
      queryClient.setQueryData<GroceriesData>(queryKey, updater);
    },
    [queryClient, queryKey]
  );

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  return {
    setGroceriesData,
    invalidate,
  };
}
