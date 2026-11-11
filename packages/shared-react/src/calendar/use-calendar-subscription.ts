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

  // Each event merges by id into every cached range, mounted or not, so a range served
  // later without a refetch is current and a repeat (or the actor's own result) is a no-op.
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
