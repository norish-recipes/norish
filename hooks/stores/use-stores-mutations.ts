"use client";

import type { StoreDto, StoreCreateDto, StoreUpdateInput } from "@/types";

import { useMutation } from "@tanstack/react-query";

import { useStoresQuery } from "./use-stores-query";

import { useTRPC } from "@/app/providers/trpc-provider";

export type StoresMutationsResult = {
  createStore: (data: StoreCreateDto) => Promise<string>;
  updateStore: (data: StoreUpdateInput) => void;
  deleteStore: (storeId: string, deleteGroceries: boolean) => void;
  reorderStores: (storeIds: string[]) => void;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
  isReordering: boolean;
};

export function useStoresMutations(): StoresMutationsResult {
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
          // Optimistically add the store
          const newStore: StoreDto = {
            id: storeId,
            userId: "", // Will be set by server
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
    // Optimistically update
    setStoresData((prev) => {
      if (!prev) return prev;
      return prev.map((s) => (s.id === data.id ? { ...s, ...data } : s));
    });

    updateMutation.mutate(data, {
      onError: () => invalidate(),
    });
  };

  const deleteStore = (storeId: string, deleteGroceries: boolean) => {
    // Optimistically remove
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
    // Optimistically reorder
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
}
