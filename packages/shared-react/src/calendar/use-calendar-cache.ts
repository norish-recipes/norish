import { useQueryClient } from "@tanstack/react-query";

import type { PlannedItemFromQuery } from "@norish/shared/contracts";
import type { CalendarRealtime } from "@norish/shared/contracts/realtime/calendar";
import type { PayloadOf } from "@norish/shared/contracts/realtime/catalogue";
import type { PlannedItemWithRecipePayload } from "@norish/shared/contracts/zod";

import type { CachedCalendarRange, CalendarCacheHelpers } from "./types";
import { useTRPC } from "../trpc";
import {
  applyMoveEchoInRange,
  calendarRangeOfQueryKey,
  upsertItemInRange,
} from "./calendar-cache-merge";

/** Every cached `calendar.listItems` range, mounted or not; a range with no data yet reads the server. */
export function useCalendarCacheHelpers(): CalendarCacheHelpers {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const listKey = trpc.calendar.listItems.queryKey();

  const cachedRanges = (): CachedCalendarRange[] =>
    queryClient
      .getQueriesData<PlannedItemFromQuery[]>({ queryKey: listKey })
      .flatMap(([key, items]) => {
        const range = calendarRangeOfQueryKey(key);

        return range && items ? [{ key, range, items }] : [];
      });

  const upsertItemAcrossRanges = (item: PlannedItemWithRecipePayload) => {
    for (const { key, range } of cachedRanges()) {
      queryClient.setQueryData<PlannedItemFromQuery[]>(key, (prev) =>
        upsertItemInRange(prev ?? [], item, range.startISO, range.endISO)
      );
    }
  };

  const removeItemAcrossRanges = (itemId: string) => {
    for (const { key } of cachedRanges()) {
      queryClient.setQueryData<PlannedItemFromQuery[]>(key, (prev) =>
        prev ? prev.filter((item) => item.id !== itemId) : prev
      );
    }
  };

  const applyMoveEchoAcrossRanges = (payload: PayloadOf<CalendarRealtime, "itemMoved">) => {
    for (const { key, range } of cachedRanges()) {
      queryClient.setQueryData<PlannedItemFromQuery[]>(key, (prev) =>
        applyMoveEchoInRange(prev ?? [], payload, range)
      );
    }
  };

  const invalidateAllRanges = () => {
    void queryClient.invalidateQueries({ queryKey: listKey });
  };

  return {
    cachedRanges,
    upsertItemAcrossRanges,
    removeItemAcrossRanges,
    applyMoveEchoAcrossRanges,
    invalidateAllRanges,
  };
}
