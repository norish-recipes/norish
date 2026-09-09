import { useQueryClient } from "@tanstack/react-query";
import { useSubscription } from "@trpc/tanstack-react-query";

import type { StoreDto } from "@norish/shared/contracts";

import type { CreateStoresHooksOptions, StoresCacheHelpers } from "./types";
import type { StoreAislesData } from "./use-store-aisles";

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
    const queryClient = useQueryClient();
    const aisleLinksKey = trpc.stores.aisleLinks.queryKey();

    /**
     * A Store's aisles changed: the links of an aisle it no longer has went
     * with it on the server, by cascade, and so go here too, at once; the
     * links are then read again, so what is held is what the server holds.
     */
    const keepAisleLinksHonest = (storeId: string, aisles: StoreDto["aisles"] | null) => {
      queryClient.setQueryData<StoreAislesData>(aisleLinksKey, (prev) =>
        (prev ?? []).filter(
          (link) =>
            link.storeId !== storeId ||
            (aisles !== null && aisles.some((aisle) => aisle.id === link.aisleId))
        )
      );
      void queryClient.invalidateQueries({ queryKey: aisleLinksKey });
    };

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
          const store = payload.store as StoreDto;

          setStoresData((prev) => {
            if (!prev) return prev;

            return prev.map((s) => (s.id === store.id ? { ...s, ...store } : s));
          });
          keepAisleLinksHonest(store.id, store.aisles);
        },
      })
    );

    useSubscription(
      trpc.stores.onDeleted.subscriptionOptions(undefined, {
        onData: ({ payload }: any) => {
          const storeId = payload.storeId as string;

          setStoresData((prev) => {
            if (!prev) return prev;

            return prev.filter((s) => s.id !== storeId);
          });
          keepAisleLinksHonest(storeId, null);
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
