import { useQueryClient } from "@tanstack/react-query";

import type { PlannedItemFromQuery } from "@norish/shared/contracts";
import type { CalendarRealtime } from "@norish/shared/contracts/realtime/calendar";
import type { EventName, PayloadOf } from "@norish/shared/contracts/realtime/catalogue";
import type { RecipesRealtime } from "@norish/shared/contracts/realtime/recipes";

import { useRealtimeSubscription } from "../realtime/use-realtime-subscription";
import { useTRPC } from "../trpc";
import { isDateInRange, sortCalendarItems, toPlannedItemFromPayload } from "./calendar-cache-merge";
import { useCalendarCacheHelpers } from "./use-calendar-cache";

type Payload<E extends EventName<CalendarRealtime>> = PayloadOf<CalendarRealtime, E>;

export function useCalendarSubscription(startISO: string, endISO: string) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { upsertItemAcrossRanges, removeItemAcrossRanges } = useCalendarCacheHelpers();
  const rangeKey = trpc.calendar.listItems.queryKey({ startISO, endISO });

  const setItems = (updater: (prev: PlannedItemFromQuery[]) => PlannedItemFromQuery[]) => {
    queryClient.setQueryData<PlannedItemFromQuery[]>(rangeKey, (prev) => updater(prev ?? []));
  };

  // Every cached range: the item events merge into each, an edited recipe rereads each.
  const live = { liveQueryKeys: [trpc.calendar.listItems.pathKey()] };

  // A created, edited or deleted item converges every cached range, not only
  // the one this screen shows: the calendar page's own range sits in the
  // cache while the dashboard is open, and a later visit or a range switch
  // may serve it without a refetch. The merge is by id, so the same event
  // reaching several mounted ranges — or the actor's own mutation result
  // arriving first — is a no-op the second time.
  useRealtimeSubscription<Payload<"itemCreated">>(trpc.calendar.onItemCreated, {
    ...live,
    onEvent: (payload) => {
      upsertItemAcrossRanges(payload.item);
    },
  });

  useRealtimeSubscription<Payload<"itemDeleted">>(trpc.calendar.onItemDeleted, {
    ...live,
    onEvent: (payload) => {
      removeItemAcrossRanges(payload.itemId);
    },
  });

  useRealtimeSubscription<Payload<"itemMoved">>(trpc.calendar.onItemMoved, {
    ...live,
    onEvent: (payload) => {
      setItems((prev) => {
        const itemIsInRange = isDateInRange(payload.item.date, startISO, endISO);
        const targetSortMap = new Map(
          payload.targetSlotItems.map((item) => [item.id, item.sortOrder])
        );
        const sourceSortMap = payload.sourceSlotItems
          ? new Map(payload.sourceSlotItems.map((item) => [item.id, item.sortOrder]))
          : null;

        const updated = prev
          .filter((item) => item.id !== payload.item.id || itemIsInRange)
          .map((item) => {
            if (item.id === payload.item.id) {
              return toPlannedItemFromPayload(payload.item, item);
            }

            if (targetSortMap.has(item.id)) {
              return {
                ...item,
                sortOrder: targetSortMap.get(item.id)!,
              };
            }

            if (sourceSortMap?.has(item.id)) {
              return {
                ...item,
                sortOrder: sourceSortMap.get(item.id)!,
              };
            }

            return item;
          });

        if (!itemIsInRange || updated.some((item) => item.id === payload.item.id)) {
          return sortCalendarItems(updated);
        }

        return sortCalendarItems([...updated, toPlannedItemFromPayload(payload.item)]);
      });
    },
  });

  useRealtimeSubscription<Payload<"itemUpdated">>(trpc.calendar.onItemUpdated, {
    ...live,
    onEvent: (payload) => {
      upsertItemAcrossRanges(payload.item);
    },
  });

  useRealtimeSubscription<Payload<"failed">>(trpc.calendar.onFailed, {
    ...live,
    onEvent: () => {
      void queryClient.invalidateQueries({ queryKey: rangeKey });
    },
  });

  // A planned recipe shows its recipe's name and image in every cached range; an
  // enrichment changes neither.
  useRealtimeSubscription<PayloadOf<RecipesRealtime, "updated">>(trpc.recipes.onUpdated, {
    ...live,
    onEvent: ({ source }) => {
      if (source === "enrichment") return;
      void queryClient.invalidateQueries({ queryKey: trpc.calendar.listItems.queryKey() });
    },
  });
}
