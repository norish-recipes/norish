import { useQueryClient } from "@tanstack/react-query";

import type { StoreDto } from "@norish/shared/contracts";
import type { EventName, PayloadOf } from "@norish/shared/contracts/realtime/catalogue";
import type { StoresRealtime } from "@norish/shared/contracts/realtime/stores";

import type { CreateStoresHooksOptions, StoresCacheHelpers } from "./types";
import type { StoreAislesData } from "./use-store-aisles";
import { useRealtimeSubscription } from "../../realtime/use-realtime-subscription";

type Payload<E extends EventName<StoresRealtime>> = PayloadOf<StoresRealtime, E>;

type CreateUseStoresSubscriptionOptions = CreateStoresHooksOptions & {
  useStoresCacheHelpers: () => StoresCacheHelpers;
};

export function createUseStoresSubscription({
  useTRPC,
  useStoresCacheHelpers,
}: CreateUseStoresSubscriptionOptions) {
  return function useStoresSubscription() {
    const trpc = useTRPC();
    const { setStoresData, invalidate } = useStoresCacheHelpers();
    const queryClient = useQueryClient();
    const aisleLinksKey = trpc.stores.aisleLinks.queryKey();

    // A lagged subscription refetches the stores and the links that hang off them.
    const lag = {
      onLag: () => {
        invalidate();
        void queryClient.invalidateQueries({ queryKey: aisleLinksKey });
      },
    };

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

    useRealtimeSubscription<Payload<"created">>(trpc.stores.onCreated, {
      ...lag,
      onEvent: ({ store }) => {
        setStoresData((prev) => {
          if (!prev) return [store];
          const exists = prev.some((s) => s.id === store.id);

          if (exists) {
            return prev.map((s) => (s.id === store.id ? store : s));
          }

          return [...prev, store].sort((a, b) => a.sortOrder - b.sortOrder);
        });
      },
    });

    useRealtimeSubscription<Payload<"updated">>(trpc.stores.onUpdated, {
      ...lag,
      onEvent: ({ store }) => {
        setStoresData((prev) => {
          if (!prev) return prev;

          return prev.map((s) => (s.id === store.id ? { ...s, ...store } : s));
        });
        keepAisleLinksHonest(store.id, store.aisles);
      },
    });

    useRealtimeSubscription<Payload<"deleted">>(trpc.stores.onDeleted, {
      ...lag,
      onEvent: ({ storeId }) => {
        setStoresData((prev) => {
          if (!prev) return prev;

          return prev.filter((s) => s.id !== storeId);
        });
        keepAisleLinksHonest(storeId, null);
      },
    });

    useRealtimeSubscription<Payload<"reordered">>(trpc.stores.onReordered, {
      ...lag,
      onEvent: ({ stores }) => {
        setStoresData((prev) => {
          if (!prev) return stores;
          const storeMap = new Map(prev.map((s) => [s.id, s]));
          const updatedStores = stores.map((incoming) => {
            const existing = storeMap.get(incoming.id);

            return existing ? { ...existing, ...incoming } : incoming;
          });
          const reorderedIds = new Set(stores.map((s) => s.id));
          const remaining = prev.filter((s) => !reorderedIds.has(s.id));

          return [...updatedStores, ...remaining];
        });
      },
    });
  };
}
