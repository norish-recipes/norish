"use client";

import type { Slot } from "@/types";
import type { QueryKey } from "@tanstack/react-query";

import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useMemo, useCallback } from "react";

import { useTRPC } from "@/app/providers/trpc-provider";

type PlannedItemFromQuery = {
  id: string;
  userId: string;
  date: string;
  slot: Slot;
  sortOrder: number;
  itemType: "recipe" | "note";
  recipeId: string | null;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CalendarData = Record<string, PlannedItemFromQuery[]>;

export type CalendarQueryResult = {
  items: PlannedItemFromQuery[];
  calendarData: CalendarData;
  isLoading: boolean;
  error: unknown;
  queryKey: QueryKey;
  setCalendarData: (updater: (prev: CalendarData) => CalendarData) => void;
  invalidate: () => void;
};

function groupItemsByDate(items: PlannedItemFromQuery[]): CalendarData {
  const grouped: CalendarData = {};

  for (const item of items) {
    if (!grouped[item.date]) {
      grouped[item.date] = [];
    }
    grouped[item.date].push(item);
  }

  return grouped;
}

export function useCalendarQuery(startISO: string, endISO: string): CalendarQueryResult {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const queryKey = trpc.calendar.listItems.queryKey({ startISO, endISO });

  const { data, error, isLoading } = useQuery(
    trpc.calendar.listItems.queryOptions(
      { startISO, endISO },
      {
        staleTime: 1000 * 60 * 5,
        refetchOnWindowFocus: false,
      }
    )
  );

  const items = useMemo(() => data ?? [], [data]);
  const calendarData = useMemo(() => groupItemsByDate(items), [items]);

  const setCalendarData = useCallback(
    (updater: (prev: CalendarData) => CalendarData) => {
      queryClient.setQueryData<PlannedItemFromQuery[]>(queryKey, (prev) => {
        const currentData = groupItemsByDate(prev ?? []);
        const newData = updater(currentData);

        return Object.values(newData).flat();
      });
    },
    [queryClient, queryKey]
  );

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  return {
    items,
    calendarData,
    isLoading,
    error,
    queryKey,
    setCalendarData,
    invalidate,
  };
}
