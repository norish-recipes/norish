"use client";

import type { CalendarItemViewDto, Slot } from "@/types";
import type { QueryKey } from "@tanstack/react-query";

import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useMemo, useCallback } from "react";

import { useTRPC } from "@/app/providers/trpc-provider";

export type CalendarData = Record<string, CalendarItemViewDto[]>;

export type CalendarQueryResult = {
  calendarData: CalendarData;
  isLoading: boolean;
  error: unknown;
  recipesQueryKey: QueryKey;
  notesQueryKey: QueryKey;
  setCalendarData: (updater: (prev: CalendarData) => CalendarData) => void;
  removeRecipeFromCache: (id: string) => void;
  updateRecipeInCache: (id: string, newDate: string) => void;
  removeNoteFromCache: (id: string) => void;
  updateNoteInCache: (id: string, newDate: string) => void;
  invalidate: () => void;
};

export function useCalendarQuery(startISO: string, endISO: string): CalendarQueryResult {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Query keys for both recipes and notes
  const recipesQueryKey = trpc.calendar.listRecipes.queryKey({ startISO, endISO });
  const notesQueryKey = trpc.calendar.listNotes.queryKey({ startISO, endISO });
  const combinedQueryKey = useMemo(
    () => ["calendar", "combined", startISO, endISO],
    [startISO, endISO]
  );

  // Fetch recipes
  const recipesQuery = useQuery(trpc.calendar.listRecipes.queryOptions({ startISO, endISO }));

  // Fetch notes
  const notesQuery = useQuery(trpc.calendar.listNotes.queryOptions({ startISO, endISO }));

  // Subscribe to the combined key for optimistic/subscription updates
  // This query never fetches - it only holds data set by setCalendarData
  const optimisticQuery = useQuery({
    queryKey: combinedQueryKey,
    queryFn: () => ({}) as CalendarData,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const optimisticData = optimisticQuery.data;

  // Combine into date-grouped format, merging with optimistic updates
  const calendarData = useMemo(() => {
    const data: CalendarData = {};

    if (recipesQuery.data) {
      for (const r of recipesQuery.data) {
        const k = r.date;

        (data[k] ||= []).push({
          itemType: "recipe",
          id: r.id,
          recipeId: r.recipeId,
          recipeName: r.recipeName ?? "Unknown",
          slot: r.slot as Slot,
          date: k,
          allergyWarnings: r.allergyWarnings,
        });
      }
    }

    if (notesQuery.data) {
      for (const n of notesQuery.data) {
        const k = n.date;

        (data[k] ||= []).push({
          itemType: "note",
          id: n.id,
          title: n.title,
          recipeId: n.recipeId ?? null,
          slot: n.slot as Slot,
          date: k,
        });
      }
    }

    // Merge optimistic updates - items in optimisticData that aren't in data
    if (optimisticData) {
      for (const [date, items] of Object.entries(optimisticData)) {
        const existingIds = new Set((data[date] ?? []).map((i) => i.id));
        const newItems = items.filter((i) => !existingIds.has(i.id));

        if (newItems.length > 0) {
          data[date] = [...(data[date] ?? []), ...newItems];
        }
      }
    }

    return data;
  }, [recipesQuery.data, notesQuery.data, optimisticData]);

  const setCalendarData = useCallback(
    (updater: (prev: CalendarData) => CalendarData) => {
      queryClient.setQueryData<CalendarData>(combinedQueryKey, (prev) => updater(prev ?? {}));
    },
    [queryClient, combinedQueryKey]
  );

  // Optimistically remove a recipe from the base query cache
  const removeRecipeFromCache = useCallback(
    (id: string) => {
      queryClient.setQueryData(recipesQueryKey, (prev: typeof recipesQuery.data) =>
        prev?.filter((r) => r.id !== id)
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, recipesQueryKey]
  );

  // Optimistically update a recipe's date in the base query cache
  const updateRecipeInCache = useCallback(
    (id: string, newDate: string) => {
      queryClient.setQueryData(recipesQueryKey, (prev: typeof recipesQuery.data) =>
        prev?.map((r) => (r.id === id ? { ...r, date: newDate } : r))
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, recipesQueryKey]
  );

  // Optimistically remove a note from the base query cache
  const removeNoteFromCache = useCallback(
    (id: string) => {
      queryClient.setQueryData(notesQueryKey, (prev: typeof notesQuery.data) =>
        prev?.filter((n) => n.id !== id)
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, notesQueryKey]
  );

  // Optimistically update a note's date in the base query cache
  const updateNoteInCache = useCallback(
    (id: string, newDate: string) => {
      queryClient.setQueryData(notesQueryKey, (prev: typeof notesQuery.data) =>
        prev?.map((n) => (n.id === id ? { ...n, date: newDate } : n))
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryClient, notesQueryKey]
  );

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: recipesQueryKey });
    queryClient.invalidateQueries({ queryKey: notesQueryKey });
    queryClient.setQueryData<CalendarData>(combinedQueryKey, {});
  }, [queryClient, recipesQueryKey, notesQueryKey, combinedQueryKey]);

  return {
    calendarData,
    isLoading: recipesQuery.isLoading || notesQuery.isLoading,
    error: recipesQuery.error || notesQuery.error,
    recipesQueryKey,
    notesQueryKey,
    setCalendarData,
    removeRecipeFromCache,
    updateRecipeInCache,
    removeNoteFromCache,
    updateNoteInCache,
    invalidate,
  };
}
