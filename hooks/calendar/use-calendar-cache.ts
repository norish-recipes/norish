"use client";

/**
 * Lightweight cache manipulation helpers for calendar.
 *
 * This hook provides functions to update the React Query cache WITHOUT
 * creating query observers. Use this in subscription hooks to avoid
 * duplicate hook trees that cause recursion issues.
 *
 * For reading data + cache manipulation, use useCalendarQuery instead.
 */

import type { PlannedItemFromQuery } from "@/types";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { useTRPC } from "@/app/providers/trpc-provider";

export type CalendarCacheHelpers = {
  setCalendarData: (
    updater: (prev: PlannedItemFromQuery[] | undefined) => PlannedItemFromQuery[] | undefined
  ) => void;
  invalidate: () => void;
};

/**
 * Returns cache manipulation helpers without creating query observers.
 * Safe to call from subscription hooks - won't cause recursion.
 */
export function useCalendarCacheHelpers(startISO: string, endISO: string): CalendarCacheHelpers {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const queryKey = trpc.calendar.listItems.queryKey({ startISO, endISO });

  const setCalendarData = useCallback(
    (updater: (prev: PlannedItemFromQuery[] | undefined) => PlannedItemFromQuery[] | undefined) => {
      queryClient.setQueryData<PlannedItemFromQuery[]>(queryKey, updater);
    },
    [queryClient, queryKey]
  );

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  return {
    setCalendarData,
    invalidate,
  };
}
