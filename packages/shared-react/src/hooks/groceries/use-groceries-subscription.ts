import type { GroceryDto } from "@norish/shared/contracts";
import type { EventName, PayloadOf } from "@norish/shared/contracts/realtime/catalogue";
import type { GroceriesRealtime } from "@norish/shared/contracts/realtime/groceries";

import type { CreateGroceriesHooksOptions, GroceriesCacheHelpers } from "./types";
import { useRealtimeSubscription } from "../../realtime/use-realtime-subscription";

type Payload<E extends EventName<GroceriesRealtime>> = PayloadOf<GroceriesRealtime, E>;

export type GroceriesSubscriptionErrorAdapter = {
  showErrorToast: (reason: string) => void;
};

type CreateUseGroceriesSubscriptionOptions = CreateGroceriesHooksOptions & {
  useGroceriesCacheHelpers: () => GroceriesCacheHelpers;
  useErrorAdapter: () => GroceriesSubscriptionErrorAdapter;
};

function getStoreKey(storeId: string | null) {
  return storeId ?? "__no_store__";
}

function applyCreatedGroceriesToCache(groceries: GroceryDto[], createdGroceries: GroceryDto[]) {
  if (createdGroceries.length === 0) return groceries;

  const createdIds = new Set(createdGroceries.map((grocery) => grocery.id));
  const createdCountByStore = new Map<string, number>();

  for (const grocery of createdGroceries) {
    if (grocery.isDone) continue;

    const storeKey = getStoreKey(grocery.storeId);

    createdCountByStore.set(storeKey, (createdCountByStore.get(storeKey) ?? 0) + 1);
  }

  const shifted = groceries.map((grocery) => {
    if (grocery.isDone || createdIds.has(grocery.id)) return grocery;

    const createdCount = createdCountByStore.get(getStoreKey(grocery.storeId)) ?? 0;

    return createdCount > 0 ? { ...grocery, sortOrder: grocery.sortOrder + createdCount } : grocery;
  });

  return [...createdGroceries, ...shifted.filter((grocery) => !createdIds.has(grocery.id))];
}

export function createUseGroceriesSubscription({
  useTRPC,
  useGroceriesCacheHelpers,
  useErrorAdapter,
}: CreateUseGroceriesSubscriptionOptions) {
  return function useGroceriesSubscription() {
    const trpc = useTRPC();
    const { setGroceriesData, invalidate } = useGroceriesCacheHelpers();
    const errorAdapter = useErrorAdapter();

    // A lagged subscription refetches the list: the one domain these events touch.
    const lag = { onLag: invalidate };

    useRealtimeSubscription<Payload<"created">>(trpc.groceries.onCreated, {
      ...lag,
      onEvent: (payload) => {
        setGroceriesData((prev) => {
          if (!prev) return prev;

          const existing = prev.groceries ?? [];
          const incoming = payload.groceries;
          const newGroceries = incoming.filter((g) => !existing.some((eg) => eg.id === g.id));

          if (newGroceries.length === 0) return prev;

          return {
            ...prev,
            groceries: applyCreatedGroceriesToCache(existing, newGroceries),
          };
        });
      },
    });

    useRealtimeSubscription<Payload<"updated">>(trpc.groceries.onUpdated, {
      ...lag,
      onEvent: (payload) => {
        setGroceriesData((prev) => {
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
        setGroceriesData((prev) => {
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
        setGroceriesData((prev) => {
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
        setGroceriesData((prev) => {
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
        setGroceriesData((prev) => {
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
        errorAdapter.showErrorToast(payload.reason);
        invalidate();
      },
    });

    // A version-guarded write lost a race and was dropped. Silently refetch so
    // any optimistic state converges to the DB — no error toast.
    useRealtimeSubscription<Payload<"stale">>(trpc.groceries.onStale, {
      ...lag,
      onEvent: () => {
        invalidate();
      },
    });
  };
}
