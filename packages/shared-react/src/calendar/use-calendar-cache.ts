import type { QueryKey } from "@tanstack/react-query";
import { partialMatchKey, useQueryClient } from "@tanstack/react-query";

import type { PlannedItemFromQuery } from "@norish/shared/contracts";
import type { CalendarRealtime } from "@norish/shared/contracts/realtime/calendar";
import type { PayloadOf } from "@norish/shared/contracts/realtime/catalogue";
import type { PlannedItemWithRecipePayload } from "@norish/shared/contracts/zod";

import type { CachedCalendarRange, CalendarCacheHelpers } from "./types";
import { rereadOnceWritesSettle } from "../realtime/use-realtime-subscription";
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

  // `setQueryData` clears `isInvalidated`, so a flagged range no component shows would
  // mount later without a read: flag it again, without refetching.
  const writeRange = (key: QueryKey, items: PlannedItemFromQuery[]) => {
    const wasInvalidated = queryClient.getQueryState(key)?.isInvalidated;

    queryClient.setQueryData<PlannedItemFromQuery[]>(key, items);
    if (wasInvalidated) {
      void queryClient.invalidateQueries({ queryKey: key, exact: true, refetchType: "none" });
    }
  };

  const upsertItemAcrossRanges = (item: PlannedItemWithRecipePayload) => {
    for (const { key, range, items } of cachedRanges()) {
      writeRange(key, upsertItemInRange(items, item, range));
    }
  };

  const removeItemAcrossRanges = (itemId: string) => {
    for (const { key, items } of cachedRanges()) {
      writeRange(
        key,
        items.filter((item) => item.id !== itemId)
      );
    }
  };

  const applyMoveEchoAcrossRanges = (payload: PayloadOf<CalendarRealtime, "itemMoved">) => {
    for (const { key, range, items } of cachedRanges()) {
      writeRange(key, applyMoveEchoInRange(items, payload, range));
    }
  };

  const rereadAllRanges = () => {
    rereadOnceWritesSettle(queryClient, (query) => partialMatchKey(query.queryKey, listKey));
  };

  return {
    cachedRanges,
    writeRange,
    upsertItemAcrossRanges,
    removeItemAcrossRanges,
    applyMoveEchoAcrossRanges,
    rereadAllRanges,
  };
}
