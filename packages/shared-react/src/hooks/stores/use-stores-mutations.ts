import { useMutation } from "@tanstack/react-query";

import type { StoreCreateDto, StoreDeleteInput, StoreDto } from "@norish/shared/contracts";

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
              version: 1,
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

    const updateStore = (data: StoreUpdateDraft) => {
      setStoresData((prev) => {
        if (!prev) return prev;

        return prev.map((s) => (s.id === data.id ? { ...s, ...data } : s));
      });

      updateMutation.mutate(
        { ...data, version: getStoreVersion(data.id) },
        {
          onError: () => invalidate(),
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
