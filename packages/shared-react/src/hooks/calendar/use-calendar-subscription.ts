import type { PlannedItemFromQuery } from "@norish/shared/contracts";
import type { CalendarRealtime } from "@norish/shared/contracts/realtime/calendar";
import type { EventName, PayloadOf } from "@norish/shared/contracts/realtime/catalogue";

import type { CalendarCacheHelpers, CreateCalendarHooksOptions } from "./types";
import { useRealtimeSubscription } from "../../realtime/use-realtime-subscription";
import { isDateInRange, sortCalendarItems, toPlannedItemFromPayload } from "./calendar-cache-merge";

type Payload<E extends EventName<CalendarRealtime>> = PayloadOf<CalendarRealtime, E>;

type CreateUseCalendarSubscriptionOptions = CreateCalendarHooksOptions & {
  useCalendarCacheHelpers: (startISO: string, endISO: string) => CalendarCacheHelpers;
};

export function createUseCalendarSubscription({
  useTRPC,
  useCalendarCacheHelpers,
}: CreateUseCalendarSubscriptionOptions) {
  return function useCalendarSubscription(startISO: string, endISO: string) {
    const trpc = useTRPC();
    const { setCalendarData, invalidate, upsertItemAcrossRanges, removeItemAcrossRanges } =
      useCalendarCacheHelpers(startISO, endISO);

    const setItems = (updater: (prev: PlannedItemFromQuery[]) => PlannedItemFromQuery[]) => {
      setCalendarData((prev) => updater(prev ?? []));
    };

    // A lagged subscription refetches the range this screen shows.
    const lag = { onLag: invalidate };

    // A created, edited or deleted item converges every cached range, not only
    // the one this screen shows: the calendar page's own range sits in the
    // cache while the dashboard is open, and a later visit or a range switch
    // may serve it without a refetch. The merge is by id, so the same event
    // reaching several mounted ranges — or the actor's own mutation result
    // arriving first — is a no-op the second time.
    useRealtimeSubscription<Payload<"itemCreated">>(trpc.calendar.onItemCreated, {
      ...lag,
      onEvent: (payload) => {
        upsertItemAcrossRanges(payload.item);
      },
    });

    useRealtimeSubscription<Payload<"itemDeleted">>(trpc.calendar.onItemDeleted, {
      ...lag,
      onEvent: (payload) => {
        removeItemAcrossRanges(payload.itemId);
      },
    });

    useRealtimeSubscription<Payload<"itemMoved">>(trpc.calendar.onItemMoved, {
      ...lag,
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
      ...lag,
      onEvent: (payload) => {
        upsertItemAcrossRanges(payload.item);
      },
    });

    useRealtimeSubscription<Payload<"failed">>(trpc.calendar.onFailed, {
      ...lag,
      onEvent: () => {
        invalidate();
      },
    });
  };
}
