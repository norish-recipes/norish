import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { PlannedItemFromQuery } from "@norish/shared/contracts";
import type { PlannedItemWithRecipePayload } from "@norish/shared/contracts/zod";

import type { CalendarCacheHelpers, CreateCalendarHooksOptions } from "./types";
import { calendarRangeOfQueryKey, upsertItemInRange } from "./calendar-cache-merge";

export function createUseCalendarCache({ useTRPC }: CreateCalendarHooksOptions) {
  return function useCalendarCacheHelpers(startISO: string, endISO: string): CalendarCacheHelpers {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const queryKey = trpc.calendar.listItems.queryKey({ startISO, endISO });

    const setCalendarData = useCallback(
      (
        updater: (prev: PlannedItemFromQuery[] | undefined) => PlannedItemFromQuery[] | undefined
      ) => {
        queryClient.setQueryData<PlannedItemFromQuery[]>(queryKey, updater);
      },
      [queryClient, queryKey]
    );

    const invalidate = useCallback(() => {
      queryClient.invalidateQueries({ queryKey });
    }, [queryClient, queryKey]);

    // Every `calendar.listItems` range the cache holds, mounted or not, with
    // the range it was fetched for. Ranges without data yet are left alone:
    // their first fetch reads the server.
    const cachedRanges = useCallback(
      () =>
        queryClient
          .getQueryCache()
          .findAll({ queryKey: trpc.calendar.listItems.queryKey() })
          .flatMap((query) => {
            const range = calendarRangeOfQueryKey(query.queryKey);

            return range && query.state.data !== undefined ? [{ key: query.queryKey, range }] : [];
          }),
      [queryClient, trpc]
    );

    const upsertItemAcrossRanges = useCallback(
      (item: PlannedItemWithRecipePayload) => {
        for (const { key, range } of cachedRanges()) {
          queryClient.setQueryData<PlannedItemFromQuery[]>(key, (prev) =>
            upsertItemInRange(prev ?? [], item, range.startISO, range.endISO)
          );
        }
      },
      [cachedRanges, queryClient]
    );

    const removeItemAcrossRanges = useCallback(
      (itemId: string) => {
        for (const { key } of cachedRanges()) {
          queryClient.setQueryData<PlannedItemFromQuery[]>(key, (prev) =>
            prev ? prev.filter((item) => item.id !== itemId) : prev
          );
        }
      },
      [cachedRanges, queryClient]
    );

    return { setCalendarData, invalidate, upsertItemAcrossRanges, removeItemAcrossRanges };
  };
}
