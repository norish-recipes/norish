import { useSubscription } from "@trpc/tanstack-react-query";

import type { GroceryDto, RecurringGroceryDto } from "@norish/shared/contracts";

import type { CreateGroceriesHooksOptions, GroceriesCacheHelpers } from "./types";

type GrocerySubscriptionEventPayloads = {
  created: { groceries: GroceryDto[] };
  updated: { changedGroceries: GroceryDto[] };
  deleted: { groceryIds: string[] };
  recurringCreated: { recurringGrocery: RecurringGroceryDto; grocery: GroceryDto };
  recurringUpdated: { recurringGrocery: RecurringGroceryDto; grocery: GroceryDto };
  recurringDeleted: { recurringGroceryId: string };
  failed: { reason: string };
};

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

    // onCreated
    useSubscription(
      trpc.groceries.onCreated.subscriptionOptions(undefined, {
        onData: (payload: GrocerySubscriptionEventPayloads["created"]) => {
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
      })
    );

    // onUpdated
    useSubscription(
      trpc.groceries.onUpdated.subscriptionOptions(undefined, {
        onData: (payload: GrocerySubscriptionEventPayloads["updated"]) => {
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
      })
    );

    // onDeleted
    useSubscription(
      trpc.groceries.onDeleted.subscriptionOptions(undefined, {
        onData: (payload: GrocerySubscriptionEventPayloads["deleted"]) => {
          setGroceriesData((prev) => {
            if (!prev) return prev;

            const filtered = prev.groceries.filter((g) => !payload.groceryIds.includes(g.id));

            if (filtered.length === prev.groceries.length) return prev;

            return { ...prev, groceries: filtered };
          });
        },
      })
    );

    // onRecurringCreated
    useSubscription(
      trpc.groceries.onRecurringCreated.subscriptionOptions(undefined, {
        onData: (payload: GrocerySubscriptionEventPayloads["recurringCreated"]) => {
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
      })
    );

    // onRecurringUpdated
    useSubscription(
      trpc.groceries.onRecurringUpdated.subscriptionOptions(undefined, {
        onData: (payload: GrocerySubscriptionEventPayloads["recurringUpdated"]) => {
          setGroceriesData((prev) => {
            if (!prev) return prev;

            const { recurringGrocery: updatedRecurring, grocery: updatedGrocery } = payload;

            return {
              ...prev,
              groceries: prev.groceries.map((g) =>
                g.id === updatedGrocery.id ? updatedGrocery : g
              ),
              recurringGroceries: prev.recurringGroceries.map((r) =>
                r.id === updatedRecurring.id ? updatedRecurring : r
              ),
            };
          });
        },
      })
    );

    // onRecurringDeleted
    useSubscription(
      trpc.groceries.onRecurringDeleted.subscriptionOptions(undefined, {
        onData: (payload: GrocerySubscriptionEventPayloads["recurringDeleted"]) => {
          setGroceriesData((prev) => {
            if (!prev) return prev;

            return {
              ...prev,
              groceries: prev.groceries.filter(
                (g) => g.recurringGroceryId !== payload.recurringGroceryId
              ),
              recurringGroceries: prev.recurringGroceries.filter(
                (r) => r.id !== payload.recurringGroceryId
              ),
            };
          });
        },
      })
    );

    // onFailed
    useSubscription(
      trpc.groceries.onFailed.subscriptionOptions(undefined, {
        onData: (payload: GrocerySubscriptionEventPayloads["failed"]) => {
          errorAdapter.showErrorToast(payload.reason);
          invalidate();
        },
      })
    );
  };
}
