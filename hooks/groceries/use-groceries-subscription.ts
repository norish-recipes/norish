"use client";

import { useSubscription } from "@trpc/tanstack-react-query";
import { addToast } from "@heroui/react";

import { useGroceriesQuery } from "./use-groceries-query";

import { useTRPC } from "@/app/providers/trpc-provider";

/**
 * Hook that subscribes to all grocery-related WebSocket events
 * and updates the query cache accordingly.
 *
 */
export function useGroceriesSubscription() {
  const trpc = useTRPC();
  const { setGroceriesData, invalidate } = useGroceriesQuery();

  // onCreated
  useSubscription(
    trpc.groceries.onCreated.subscriptionOptions(undefined, {
      onData: (payload) => {
        setGroceriesData((prev) => {
          if (!prev) return prev;

          const existing = prev.groceries ?? [];
          const incoming = payload.groceries;
          const newGroceries = incoming.filter((g) => !existing.some((eg) => eg.id === g.id));

          if (newGroceries.length === 0) return prev;

          return { ...prev, groceries: [...newGroceries, ...existing] };
        });
      },
    })
  );

  // onUpdated
  useSubscription(
    trpc.groceries.onUpdated.subscriptionOptions(undefined, {
      onData: (payload) => {
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
      onData: (payload) => {
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
      onData: (payload) => {
        setGroceriesData((prev) => {
          if (!prev) return prev;

          const { grocery: newGrocery, recurringGrocery: newRecurring } = payload;

          const groceries = prev.groceries.some((g) => g.id === newGrocery.id)
            ? prev.groceries.map((g) => (g.id === newGrocery.id ? newGrocery : g))
            : [newGrocery, ...prev.groceries];

          const recurringGroceries = prev.recurringGroceries.some((r) => r.id === newRecurring.id)
            ? prev.recurringGroceries.map((r) => (r.id === newRecurring.id ? newRecurring : r))
            : [newRecurring, ...prev.recurringGroceries];

          return { groceries, recurringGroceries };
        });
      },
    })
  );

  // onRecurringUpdated
  useSubscription(
    trpc.groceries.onRecurringUpdated.subscriptionOptions(undefined, {
      onData: (payload) => {
        setGroceriesData((prev) => {
          if (!prev) return prev;

          const { recurringGrocery: updatedRecurring, grocery: updatedGrocery } = payload;

          return {
            groceries: prev.groceries.map((g) => (g.id === updatedGrocery.id ? updatedGrocery : g)),
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
      onData: (payload) => {
        setGroceriesData((prev) => {
          if (!prev) return prev;

          return {
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
      onData: (payload) => {
        addToast({
          severity: "danger",
          title: payload.reason,
          timeout: 2000,
          shouldShowTimeoutProgress: true,
          radius: "full",
        });
        invalidate();
      },
    })
  );
}
