import type { CalendarRealtime } from "@norish/shared/contracts/realtime/calendar";
import type { EventName, PayloadOf } from "@norish/shared/contracts/realtime/catalogue";
import type { RecipesRealtime } from "@norish/shared/contracts/realtime/recipes";

import { useRealtimeSubscription } from "../realtime/use-realtime-subscription";
import { useTRPC } from "../trpc";
import { useCalendarCacheHelpers } from "./use-calendar-cache";

type Payload<E extends EventName<CalendarRealtime>> = PayloadOf<CalendarRealtime, E>;

export function useCalendarSubscription() {
  const trpc = useTRPC();
  const {
    upsertItemAcrossRanges,
    removeItemAcrossRanges,
    applyMoveEchoAcrossRanges,
    invalidateAllRanges,
  } = useCalendarCacheHelpers();

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
      applyMoveEchoAcrossRanges(payload);
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
      invalidateAllRanges();
    },
  });

  // A planned recipe shows its recipe's name and image in every cached range; an
  // enrichment changes neither.
  useRealtimeSubscription<PayloadOf<RecipesRealtime, "updated">>(trpc.recipes.onUpdated, {
    ...live,
    onEvent: ({ source }) => {
      if (source === "enrichment") return;
      invalidateAllRanges();
    },
  });
}
