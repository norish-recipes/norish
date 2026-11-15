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

  // `setQueryData` clears `isInvalidated`, so flag it again without refetching, or an unshown range
  // would mount without a read; a never-read range keeps `dataUpdatedAt` 0, so it stays unread.
  const writeRange = (key: QueryKey, items: PlannedItemFromQuery[]) => {
    const state = queryClient.getQueryState(key);
    const wasInvalidated = state?.isInvalidated;

    queryClient.setQueryData<PlannedItemFromQuery[]>(
      key,
      items,
      state?.dataUpdatedAt === 0 ? { updatedAt: 0 } : undefined
    );
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
