import { useMutation } from "@tanstack/react-query";

import type { StoreCreateDto, StoreDeleteInput, StoreDto } from "@norish/shared/contracts";
import { createClientId } from "@norish/shared/lib/operation-helpers";

import {
  invalidateUnlessPreserved,
  shouldPreserveOptimisticUpdate as preserveOptimisticUpdate,
} from "../optimistic-updates";

import type {
  CreateStoresHooksOptions,
  StoreGrocerySnapshot,
  StoresMutationsResult,
  StoresQueryResult,
  StoreUpdateDraft,
} from "./types";

type CreateUseStoresMutationsOptions = CreateStoresHooksOptions & {
  useStoresQuery: () => StoresQueryResult;
};

export function createUseStoresMutations({
  useTRPC,
  useStoresQuery,
}: CreateUseStoresMutationsOptions) {
  return function useStoresMutations(): StoresMutationsResult {
    const trpc = useTRPC();
    const { setStoresData, invalidate, stores } = useStoresQuery();

    const getStoreVersion = (storeId: string): number =>
      stores.find((store) => store.id === storeId)?.version ?? 1;

    // Keep an optimistic update when its mutation was Queued for Replay.
    const invalidateUnlessQueued = invalidateUnlessPreserved(invalidate);

    const createMutation = useMutation(trpc.stores.create.mutationOptions());
    const updateMutation = useMutation(trpc.stores.update.mutationOptions());
    const deleteMutation = useMutation(trpc.stores.delete.mutationOptions());
    const reorderMutation = useMutation(trpc.stores.reorder.mutationOptions());

    const createStore = (data: StoreCreateDto): Promise<string> => {
      // Client-minted id, honoured on insert so a queued offline create stays
      // addressable by later mutations (ADR-0003).
      const payload = { ...data, id: createClientId() };

      const insertOptimistic = (storeId: string) => {
        const newStore: StoreDto = {
          id: storeId,
          userId: "",
          name: data.name,
          color: data.color ?? "primary",
          icon: data.icon ?? "ShoppingBagIcon",
          sortOrder: stores.length,
          version: 1,
        };

        setStoresData((prev) => {
          if (!prev) return [newStore];
          if (prev.some((s) => s.id === storeId)) return prev;

          return [...prev, newStore];
        });
      };

      return new Promise((resolve, reject) => {
        createMutation.mutate(payload, {
          onSuccess: (storeId) => {
            insertOptimistic(storeId);
            resolve(storeId);
          },
          onError: (error) => {
            if (preserveOptimisticUpdate(error)) {
              // Queued: insert the row with the client-minted id the server will
              // honour on Replay (ADR-0003); a tentative success, not a failure.
              insertOptimistic(payload.id);
              resolve(payload.id);

              return;
            }

            invalidate();
            reject(error);
          },
        });
      });
    };

    const updateStore = (data: StoreUpdateDraft) => {
      setStoresData((prev) => {
        if (!prev) return prev;

        return prev.map((s) => (s.id === data.id ? { ...s, ...data } : s));
      });

      updateMutation.mutate(
        { ...data, version: getStoreVersion(data.id) },
        {
          onError: invalidateUnlessQueued,
        }
      );
    };

    const deleteStore = (
      storeId: string,
      deleteGroceries: boolean,
      grocerySnapshot: StoreGrocerySnapshot
    ) => {
      setStoresData((prev) => {
        if (!prev) return prev;

        return prev.filter((s) => s.id !== storeId);
      });

      const input: StoreDeleteInput = {
        storeId,
        version: getStoreVersion(storeId),
        deleteGroceries,
        grocerySnapshot,
      };

      deleteMutation.mutate(input, {
        onError: () => invalidate(),
      });
    };

    const reorderStores = (storeIds: string[]) => {
      setStoresData((prev) => {
        if (!prev) return prev;
        const storeMap = new Map(prev.map((s) => [s.id, s]));

        return storeIds
          .map((id, index) => {
            const store = storeMap.get(id);

            return store ? { ...store, sortOrder: index } : null;
          })
          .filter((s): s is StoreDto => s !== null);
      });

      reorderMutation.mutate(
        {
          stores: storeIds.map((id) => ({ id, version: getStoreVersion(id) })),
        },
        {
          onError: invalidateUnlessQueued,
        }
      );
    };

    return {
      createStore,
      updateStore,
      deleteStore,
      reorderStores,
      isCreating: createMutation.isPending,
      isUpdating: updateMutation.isPending,
      isDeleting: deleteMutation.isPending,
      isReordering: reorderMutation.isPending,
    };
  };
}
