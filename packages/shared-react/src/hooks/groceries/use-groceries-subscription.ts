import { useSubscription } from "@trpc/tanstack-react-query";

import type { CreateGroceriesHooksOptions, GroceriesCacheHelpers } from "./types";

export type GroceriesSubscriptionErrorAdapter = {
  showErrorToast: (reason: string) => void;
};

type CreateUseGroceriesSubscriptionOptions = CreateGroceriesHooksOptions & {
  useGroceriesCacheHelpers: () => GroceriesCacheHelpers;
  useErrorAdapter: () => GroceriesSubscriptionErrorAdapter;
};

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
        onData: ({ payload }: any) => {
          setGroceriesData((prev) => {
            if (!prev) return prev;

            const existing = prev.groceries ?? [];
            const incoming = payload.groceries;
            const newGroceries = incoming.filter(
              (g: any) => !existing.some((eg) => eg.id === g.id)
            );

            if (newGroceries.length === 0) return prev;

            return { ...prev, groceries: [...newGroceries, ...existing] };
          });
        },
      })
    );

    // onUpdated
    useSubscription(
      trpc.groceries.onUpdated.subscriptionOptions(undefined, {
        onData: ({ payload }: any) => {
          setGroceriesData((prev) => {
            if (!prev) return prev;

            const updated = payload.changedGroceries;
            const updatedList = prev.groceries.map((e) => {
              const match = updated.find((i: any) => i.id === e.id);

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
        onData: ({ payload }: any) => {
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
        onData: ({ payload }: any) => {
          setGroceriesData((prev) => {
            if (!prev) return prev;

            const { grocery: newGrocery, recurringGrocery: newRecurring } = payload;

            const groceries = prev.groceries.some((g) => g.id === newGrocery.id)
              ? prev.groceries.map((g) => (g.id === newGrocery.id ? newGrocery : g))
              : [newGrocery, ...prev.groceries];

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
        onData: ({ payload }: any) => {
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
        onData: ({ payload }: any) => {
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
        onData: ({ payload }: any) => {
          errorAdapter.showErrorToast(payload.reason);
          invalidate();
        },
      })
    );
  };
}
