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

import type { CalendarItemViewDto } from "@/types";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

import { useTRPC } from "@/app/providers/trpc-provider";

export type CalendarData = Record<string, CalendarItemViewDto[]>;

export type CalendarCacheHelpers = {
  setCalendarData: (updater: (prev: CalendarData) => CalendarData) => void;
  removeRecipeFromCache: (id: string) => void;
  updateRecipeInCache: (id: string, newDate: string) => void;
  removeNoteFromCache: (id: string) => void;
  updateNoteInCache: (id: string, newDate: string) => void;
  invalidate: () => void;
};

// Prefix for combined calendar queries (local-only, not tRPC)
const CALENDAR_COMBINED_PREFIX = ["calendar", "combined"] as const;

/**
 * Returns cache manipulation helpers without creating query observers.
 * Safe to call from subscription hooks - won't cause recursion.
 */
export function useCalendarCacheHelpers(): CalendarCacheHelpers {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Get base keys for partial matching - use dummy params
  const recipesBaseKey = trpc.calendar.listRecipes.queryKey({
    startISO: "",
    endISO: "",
  });
  const notesBaseKey = trpc.calendar.listNotes.queryKey({
    startISO: "",
    endISO: "",
  });

  // Extract just the procedure path for partial matching
  const recipesPath = useMemo(() => [recipesBaseKey[0]], [recipesBaseKey]);
  const notesPath = useMemo(() => [notesBaseKey[0]], [notesBaseKey]);

  const setCalendarData = useCallback(
    (updater: (prev: CalendarData) => CalendarData) => {
      // Update ALL combined calendar queries (regardless of date range)
      const queries = queryClient.getQueriesData<CalendarData>({
        queryKey: CALENDAR_COMBINED_PREFIX,
      });

      for (const [key] of queries) {
        queryClient.setQueryData<CalendarData>(key, (prev) => updater(prev ?? {}));
      }
    },
    [queryClient]
  );

  const removeRecipeFromCache = useCallback(
    (id: string) => {
      // Update ALL recipe list queries
      const queries = queryClient.getQueriesData<Array<{ id: string; date: string }>>({
        queryKey: recipesPath,
      });

      for (const [key] of queries) {
        queryClient.setQueryData(key, (prev: Array<{ id: string }> | undefined) =>
          prev?.filter((r) => r.id !== id)
        );
      }
    },
    [queryClient, recipesPath]
  );

  const updateRecipeInCache = useCallback(
    (id: string, newDate: string) => {
      // Update ALL recipe list queries
      const queries = queryClient.getQueriesData<Array<{ id: string; date: string }>>({
        queryKey: recipesPath,
      });

      for (const [key] of queries) {
        queryClient.setQueryData(key, (prev: Array<{ id: string; date: string }> | undefined) =>
          prev?.map((r) => (r.id === id ? { ...r, date: newDate } : r))
        );
      }
    },
    [queryClient, recipesPath]
  );

  const removeNoteFromCache = useCallback(
    (id: string) => {
      // Update ALL note list queries
      const queries = queryClient.getQueriesData<Array<{ id: string }>>({
        queryKey: notesPath,
      });

      for (const [key] of queries) {
        queryClient.setQueryData(key, (prev: Array<{ id: string }> | undefined) =>
          prev?.filter((n) => n.id !== id)
        );
      }
    },
    [queryClient, notesPath]
  );

  const updateNoteInCache = useCallback(
    (id: string, newDate: string) => {
      // Update ALL note list queries
      const queries = queryClient.getQueriesData<Array<{ id: string; date: string }>>({
        queryKey: notesPath,
      });

      for (const [key] of queries) {
        queryClient.setQueryData(key, (prev: Array<{ id: string; date: string }> | undefined) =>
          prev?.map((n) => (n.id === id ? { ...n, date: newDate } : n))
        );
      }
    },
    [queryClient, notesPath]
  );

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: recipesPath });
    queryClient.invalidateQueries({ queryKey: notesPath });

    // Clear all combined calendar data
    const queries = queryClient.getQueriesData<CalendarData>({
      queryKey: CALENDAR_COMBINED_PREFIX,
    });

    for (const [key] of queries) {
      queryClient.setQueryData<CalendarData>(key, {});
    }
  }, [queryClient, recipesPath, notesPath]);

  return {
    setCalendarData,
    removeRecipeFromCache,
    updateRecipeInCache,
    removeNoteFromCache,
    updateNoteInCache,
    invalidate,
  };
}
