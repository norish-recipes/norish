import { useQueryClient } from "@tanstack/react-query";

import type { EventName, PayloadOf } from "@norish/shared/contracts/realtime/catalogue";
import type { GroceriesRealtime } from "@norish/shared/contracts/realtime/groceries";

import type { GroceriesData } from "./types";
import { usePlatform } from "../platform";
import { useRealtimeSubscription } from "../realtime";
import { useTRPC } from "../trpc";
import { applyCreatedGroceriesToCache } from "./use-groceries-mutations";

type Payload<E extends EventName<GroceriesRealtime>> = PayloadOf<GroceriesRealtime, E>;

export function useGroceriesSubscription() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { showError } = usePlatform();
  const listKey = trpc.groceries.list.queryKey();

  // A lagged subscription refetches the list: the one domain these events touch.
  const lag = { lagQueryKeys: [listKey] };

  useRealtimeSubscription<Payload<"created">>(trpc.groceries.onCreated, {
    ...lag,
    onEvent: (payload) => {
      queryClient.setQueryData<GroceriesData>(listKey, (prev) => {
        if (!prev) return prev;

        const existing = prev.groceries ?? [];
        const incoming = new Map(payload.groceries.map((g) => [g.id, g]));
        // A held row no newer than the server's is the server's: an offline add whose name split.
        const held = existing.map((g) => {
          const server = incoming.get(g.id);

          return server && server.version >= g.version ? server : g;
        });
        const newGroceries = payload.groceries.filter(
          (g) => !existing.some((eg) => eg.id === g.id)
        );

        if (newGroceries.length === 0 && held.every((g, index) => g === existing[index])) {
          return prev;
        }

        return {
          ...prev,
          groceries: applyCreatedGroceriesToCache(held, newGroceries),
        };
      });
    },
  });

  useRealtimeSubscription<Payload<"updated">>(trpc.groceries.onUpdated, {
    ...lag,
    onEvent: (payload) => {
      queryClient.setQueryData<GroceriesData>(listKey, (prev) => {
        if (!prev) return prev;

        const updated = payload.changedGroceries;
        const updatedList = prev.groceries.map((e) => {
          const match = updated.find((i) => i.id === e.id);

          return match ? { ...e, ...match } : e;
        });

        return { ...prev, groceries: updatedList };
      });
    },
  });

  useRealtimeSubscription<Payload<"deleted">>(trpc.groceries.onDeleted, {
    ...lag,
    onEvent: (payload) => {
      queryClient.setQueryData<GroceriesData>(listKey, (prev) => {
        if (!prev) return prev;

        const filtered = prev.groceries.filter((g) => !payload.groceryIds.includes(g.id));

        if (filtered.length === prev.groceries.length) return prev;

        return { ...prev, groceries: filtered };
      });
    },
  });

  useRealtimeSubscription<Payload<"recurringCreated">>(trpc.groceries.onRecurringCreated, {
    ...lag,
    onEvent: (payload) => {
      queryClient.setQueryData<GroceriesData>(listKey, (prev) => {
        if (!prev) return prev;

        const { grocery: newGrocery, recurringGrocery: newRecurring } = payload;

        const groceries = prev.groceries.some((g) => g.id === newGrocery.id)
          ? prev.groceries.map((g) => (g.id === newGrocery.id ? newGrocery : g))
          : applyCreatedGroceriesToCache(prev.groceries, [newGrocery]);

        const recurringGroceries = prev.recurringGroceries.some((r) => r.id === newRecurring.id)
          ? prev.recurringGroceries.map((r) => (r.id === newRecurring.id ? newRecurring : r))
          : [newRecurring, ...prev.recurringGroceries];

        return { ...prev, groceries, recurringGroceries };
      });
    },
  });

  useRealtimeSubscription<Payload<"recurringUpdated">>(trpc.groceries.onRecurringUpdated, {
    ...lag,
    onEvent: (payload) => {
      queryClient.setQueryData<GroceriesData>(listKey, (prev) => {
        if (!prev) return prev;

        const { recurringGrocery: updatedRecurring, grocery: updatedGrocery } = payload;

        return {
          ...prev,
          groceries: prev.groceries.map((g) => (g.id === updatedGrocery.id ? updatedGrocery : g)),
          recurringGroceries: prev.recurringGroceries.map((r) =>
            r.id === updatedRecurring.id ? updatedRecurring : r
          ),
        };
      });
    },
  });

  // Only the recurring definition is removed here. When linked groceries are
  // deleted along with it, the server emits a separate "deleted" event; when
  // the recurring is merely detached, the groceries live on and arrive via
  // "updated" with recurringGroceryId cleared.
  useRealtimeSubscription<Payload<"recurringDeleted">>(trpc.groceries.onRecurringDeleted, {
    ...lag,
    onEvent: (payload) => {
      queryClient.setQueryData<GroceriesData>(listKey, (prev) => {
        if (!prev) return prev;

        return {
          ...prev,
          recurringGroceries: prev.recurringGroceries.filter(
            (r) => r.id !== payload.recurringGroceryId
          ),
        };
      });
    },
  });

  // The failing member alone hears about a validation failure (scope `user`).
  useRealtimeSubscription<Payload<"failed">>(trpc.groceries.onFailed, {
    ...lag,
    onEvent: (payload) => {
      showError(payload.reason, "groceries-subscription:onFailed");
      void queryClient.invalidateQueries({ queryKey: listKey });
    },
  });

  // A version-guarded write lost a race and was dropped. Silently refetch so
  // any optimistic state converges to the DB — no error toast.
  useRealtimeSubscription<Payload<"stale">>(trpc.groceries.onStale, {
    ...lag,
    onEvent: () => {
      void queryClient.invalidateQueries({ queryKey: listKey });
    },
  });
}
