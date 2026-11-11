import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { PlannedItemFromQuery } from "@norish/shared/contracts";

import type { CalendarData, CalendarQueryResult } from "./types";
import { useTRPC } from "../trpc";
import { calendarRangeOfQueryKey, knownItemsInRange } from "./calendar-cache-merge";

function groupItemsByDate(items: PlannedItemFromQuery[]): CalendarData {
  const grouped: CalendarData = {};

  for (const item of items) {
    (grouped[item.date] ??= []).push(item);
  }

  return grouped;
}

export function useCalendarQuery(startISO: string, endISO: string): CalendarQueryResult {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data, error, isLoading } = useQuery({
    ...trpc.calendar.listItems.queryOptions(
      { startISO, endISO },
      {
        staleTime: 1000 * 60 * 5,
        refetchOnWindowFocus: false,
      }
    ),
    // A range not read yet (the calendar page widening as it scrolls) starts
    // from what the cached ranges know of its days, so widening never blanks
    // the plans shown while its read is on the way, or when Offline it fails.
    // Stale from the start, so it is read all the same.
    initialData: () =>
      knownItemsInRange(
        queryClient
          .getQueriesData<PlannedItemFromQuery[]>({
            queryKey: trpc.calendar.listItems.queryKey(),
          })
          .flatMap(([key, items]) => {
            const range = calendarRangeOfQueryKey(key);

            return range && items ? [{ range, items }] : [];
          }),
        startISO,
        endISO
      ),
    initialDataUpdatedAt: 0,
  });

  const items = data ?? [];

  return { items, calendarData: groupItemsByDate(items), isLoading, error };
}
