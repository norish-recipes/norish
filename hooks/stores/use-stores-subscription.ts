"use client";

import { useSubscription } from "@trpc/tanstack-react-query";

import { useStoresQuery } from "./use-stores-query";

import { useTRPC } from "@/app/providers/trpc-provider";

/**
 * Hook that subscribes to all store-related WebSocket events
 * and updates the query cache accordingly.
 */
export function useStoresSubscription() {
  const trpc = useTRPC();
  const { setStoresData, invalidate } = useStoresQuery();

  // onCreated
  useSubscription(
    trpc.stores.onCreated.subscriptionOptions(undefined, {
      onData: (payload) => {
        setStoresData((prev) => {
          if (!prev) return [payload.store];
          const exists = prev.some((s) => s.id === payload.store.id);
          if (exists) {
            // Update existing store (in case data differs)
            return prev.map((s) => (s.id === payload.store.id ? payload.store : s));
          }
          return [...prev, payload.store].sort((a, b) => a.sortOrder - b.sortOrder);
        });
      },
    })
  );

  // onUpdated
  useSubscription(
    trpc.stores.onUpdated.subscriptionOptions(undefined, {
      onData: (payload) => {
        setStoresData((prev) => {
          if (!prev) return prev;
          return prev.map((s) => (s.id === payload.store.id ? { ...s, ...payload.store } : s));
        });
      },
    })
  );

  // onDeleted
  useSubscription(
    trpc.stores.onDeleted.subscriptionOptions(undefined, {
      onData: (payload) => {
        setStoresData((prev) => {
          if (!prev) return prev;
          return prev.filter((s) => s.id !== payload.storeId);
        });
      },
    })
  );

  // onReordered
  useSubscription(
    trpc.stores.onReordered.subscriptionOptions(undefined, {
      onData: (payload) => {
        setStoresData((prev) => {
          if (!prev) return payload.stores;
          // Merge with existing data, preferring incoming order
          const storeMap = new Map(prev.map((s) => [s.id, s]));
          const updatedStores = payload.stores.map((incoming) => {
            const existing = storeMap.get(incoming.id);
            return existing ? { ...existing, ...incoming } : incoming;
          });
          // Add any stores not in the reorder payload (shouldn't happen, but safe)
          const reorderedIds = new Set(payload.stores.map((s) => s.id));
          const remaining = prev.filter((s) => !reorderedIds.has(s.id));
          return [...updatedStores, ...remaining];
        });
      },
    })
  );
}
