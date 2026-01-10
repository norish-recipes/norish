"use client";

/**
 * Lightweight cache manipulation helpers for household.
 *
 * This hook provides functions to update the React Query cache WITHOUT
 * creating query observers. Use this in subscription hooks to avoid
 * duplicate hook trees that cause recursion issues.
 *
 * For reading data + cache manipulation, use useHouseholdQuery instead.
 */

import type { HouseholdData } from "./use-household-query";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { useTRPC } from "@/app/providers/trpc-provider";

export type HouseholdCacheHelpers = {
  setHouseholdData: (
    updater: (prev: HouseholdData | undefined) => HouseholdData | undefined
  ) => void;
  invalidate: () => void;
  invalidateCalendar: () => void;
};

/**
 * Returns cache manipulation helpers without creating query observers.
 * Safe to call from subscription hooks - won't cause recursion.
 */
export function useHouseholdCacheHelpers(): HouseholdCacheHelpers {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const queryKey = trpc.households.get.queryKey();
  const calendarQueryKey = trpc.calendar.listRecipes.queryKey;

  const setHouseholdData = useCallback(
    (updater: (prev: HouseholdData | undefined) => HouseholdData | undefined) => {
      queryClient.setQueryData<HouseholdData>(queryKey, updater);
    },
    [queryClient, queryKey]
  );

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  // Invalidate calendar to recompute allergy warnings when allergies change
  // Uses partial key matching to invalidate all calendar.listRecipes queries
  const invalidateCalendar = useCallback(() => {
    // Get the base key without params - this matches all listRecipes queries
    const baseKey = calendarQueryKey({} as { startISO: string; endISO: string });

    // Use just the procedure path for partial matching
    queryClient.invalidateQueries({ queryKey: [baseKey[0]] });
  }, [queryClient, calendarQueryKey]);

  return {
    setHouseholdData,
    invalidate,
    invalidateCalendar,
  };
}
