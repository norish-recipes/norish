import { useQuery } from "@tanstack/react-query";

import type { PlannedItemFromQuery } from "@norish/shared/contracts";
import type { CalendarRange } from "@norish/shared/lib/helpers";

import type { CalendarData, CalendarQueryResult } from "./types";
import { useTRPC } from "../trpc";
import { knownItemsInRange } from "./calendar-cache-merge";
import { useCalendarCacheHelpers } from "./use-calendar-cache";

function groupItemsByDate(items: PlannedItemFromQuery[]): CalendarData {
  const grouped: CalendarData = {};

  for (const item of items) {
    (grouped[item.date] ??= []).push(item);
  }

  return grouped;
}

export function useCalendarQuery(range: CalendarRange): CalendarQueryResult {
  const { startISO, endISO } = range;
  const trpc = useTRPC();
  const { cachedRanges } = useCalendarCacheHelpers();

  const { data, error, isLoading } = useQuery({
    ...trpc.calendar.listItems.queryOptions(
      { startISO, endISO },
      {
        staleTime: 1000 * 60 * 5,
        refetchOnWindowFocus: false,
      }
    ),
    // A range not read yet starts from what the cached ranges know of its days, so
    // widening never blanks the plans; stale from the start, so it is read all the same.
    initialData: () => knownItemsInRange(cachedRanges(), { startISO, endISO }),
    initialDataUpdatedAt: 0,
  });

  const items = data ?? [];

  return { items, calendarData: groupItemsByDate(items), isLoading, error };
}
