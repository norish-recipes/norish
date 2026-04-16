import { useSubscription } from "@trpc/tanstack-react-query";

import type { CreateStoresHooksOptions, StoresCacheHelpers } from "./types";

type CreateUseStoresSubscriptionOptions = CreateStoresHooksOptions & {
  useStoresCacheHelpers: () => StoresCacheHelpers;
};

export function createUseStoresSubscription({
  useTRPC,
  useStoresCacheHelpers,
}: CreateUseStoresSubscriptionOptions) {
  return function useStoresSubscription() {
    const trpc = useTRPC();
    const { setStoresData } = useStoresCacheHelpers();

    useSubscription(
      trpc.stores.onCreated.subscriptionOptions(undefined, {
        onData: ({ payload }: any) => {
          setStoresData((prev) => {
            if (!prev) return [payload.store];
            const exists = prev.some((s) => s.id === payload.store.id);

            if (exists) {
              return prev.map((s) => (s.id === payload.store.id ? payload.store : s));
            }

            return [...prev, payload.store].sort((a, b) => a.sortOrder - b.sortOrder);
          });
        },
      })
    );

    useSubscription(
      trpc.stores.onUpdated.subscriptionOptions(undefined, {
        onData: ({ payload }: any) => {
          setStoresData((prev) => {
            if (!prev) return prev;

            return prev.map((s) => (s.id === payload.store.id ? { ...s, ...payload.store } : s));
          });
        },
      })
    );

    useSubscription(
      trpc.stores.onDeleted.subscriptionOptions(undefined, {
        onData: ({ payload }: any) => {
          setStoresData((prev) => {
            if (!prev) return prev;

            return prev.filter((s) => s.id !== payload.storeId);
          });
        },
      })
    );

    useSubscription(
      trpc.stores.onReordered.subscriptionOptions(undefined, {
        onData: ({ payload }: any) => {
          setStoresData((prev) => {
            if (!prev) return payload.stores;
            const storeMap = new Map(prev.map((s) => [s.id, s]));
            const updatedStores = payload.stores.map((incoming: any) => {
              const existing = storeMap.get(incoming.id);

              return existing ? { ...existing, ...incoming } : incoming;
            });
            const reorderedIds = new Set(payload.stores.map((s: any) => s.id));
            const remaining = prev.filter((s) => !reorderedIds.has(s.id));

            return [...updatedStores, ...remaining];
          });
        },
      })
    );
  };
}
