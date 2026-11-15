import { useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { CalendarRange } from "@norish/shared/lib/helpers";

import { useTRPC } from "../trpc";

/**
 * Whether `range` holds a real read, this run's or a restored one. A seed from other ranges carries
 * `dataUpdatedAt` 0, and a write into it keeps that (`writeRange`), so neither counts.
 */
export function useCalendarRangeRead(range: CalendarRange): boolean {
  const queryClient = useQueryClient();
  const key = useTRPC().calendar.listItems.queryKey(range);

  return useSyncExternalStore(
    (onChange) => queryClient.getQueryCache().subscribe(onChange),
    () => (queryClient.getQueryState(key)?.dataUpdatedAt ?? 0) > 0
  );
}
