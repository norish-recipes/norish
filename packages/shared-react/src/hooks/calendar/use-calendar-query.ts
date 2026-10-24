import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { PlannedItemFromQuery } from "@norish/shared/contracts";

import type { CalendarData, CalendarQueryResult, CreateCalendarHooksOptions } from "./types";
import { calendarRangeOfQueryKey, knownItemsInRange } from "./calendar-cache-merge";

function groupItemsByDate(items: PlannedItemFromQuery[]): CalendarData {
  const grouped: CalendarData = {};

  for (const item of items) {
    if (!grouped[item.date]) {
      grouped[item.date] = [];
    }
    grouped[item.date]!.push(item);
  }

  return grouped;
}

export function createUseCalendarQuery({ useTRPC }: CreateCalendarHooksOptions) {
  return function useCalendarQuery(startISO: string, endISO: string): CalendarQueryResult {
    "use memo";

    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const queryKey = trpc.calendar.listItems.queryKey({ startISO, endISO });

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

    return { items, calendarData, isLoading, error, queryKey, setCalendarData, invalidate };
  };
}
