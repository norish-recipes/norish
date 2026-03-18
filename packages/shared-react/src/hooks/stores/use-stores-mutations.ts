
import type { StoreCreateDto, StoreDto, StoreUpdateInput } from "@norish/shared/contracts";
import type { CreateStoresHooksOptions, StoresMutationsResult, StoresQueryResult } from "./types";

import { useMutation } from "@tanstack/react-query";

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

    const createMutation = useMutation(trpc.stores.create.mutationOptions());
    const updateMutation = useMutation(trpc.stores.update.mutationOptions());
    const deleteMutation = useMutation(trpc.stores.delete.mutationOptions());
    const reorderMutation = useMutation(trpc.stores.reorder.mutationOptions());

    const createStore = (data: StoreCreateDto): Promise<string> => {
      return new Promise((resolve, reject) => {
        createMutation.mutate(data, {
          onSuccess: (storeId) => {
            const newStore: StoreDto = {
              id: storeId,
              userId: "",
              name: data.name,
              color: data.color ?? "primary",
              icon: data.icon ?? "ShoppingBagIcon",
              sortOrder: stores.length,
            };

            setStoresData((prev) => {
              if (!prev) return [newStore];
              const exists = prev.some((s) => s.id === storeId);

              if (exists) return prev;

              return [...prev, newStore];
            });

            resolve(storeId);
          },
          onError: (error) => {
            invalidate();
            reject(error);
          },
        });
      });
    };

    const updateStore = (data: StoreUpdateInput) => {
      setStoresData((prev) => {
        if (!prev) return prev;

        return prev.map((s) => (s.id === data.id ? { ...s, ...data } : s));
      });

      updateMutation.mutate(data, {
        onError: () => invalidate(),
      });
    };

    const deleteStore = (storeId: string, deleteGroceries: boolean) => {
      setStoresData((prev) => {
        if (!prev) return prev;

        return prev.filter((s) => s.id !== storeId);
      });

      deleteMutation.mutate(
        { storeId, deleteGroceries },
        {
          onError: () => invalidate(),
        }
      );
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
        { storeIds },
        {
          onError: () => invalidate(),
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
