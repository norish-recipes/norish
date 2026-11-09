import { useMutation, useQueryClient } from "@tanstack/react-query";

import type {
  AisleDto,
  AisleInput,
  StoreCreateDto,
  StoreDeleteInput,
  StoreDto,
  StoreSearchAddressResult,
} from "@norish/shared/contracts";
import { createClientId } from "@norish/shared/lib/operation-helpers";

import type { GroceriesData, StoresData, StoresMutationsResult, StoreUpdateDraft } from "./types";
import {
  invalidateUnlessPreserved,
  shouldPreserveOptimisticUpdate as preserveOptimisticUpdate,
} from "../offline/optimistic-updates";
import { useTRPC } from "../trpc";

/**
 * The aisles as the Store will carry them once the save lands, for the
 * optimistic row: a known aisle keeps its version unless its name or place
 * changed, in which case the server will bump it; a new one starts at 1; and
 * the position in the list is the order (ADR-0031).
 */
function optimisticAisles(storeId: string, input: AisleInput[], before: AisleDto[]): AisleDto[] {
  const known = new Map(before.map((aisle) => [aisle.id, aisle]));

  return input.map((aisle, index) => {
    const was = known.get(aisle.id);
    const changed = was !== undefined && (was.name !== aisle.name || was.sortOrder !== index);

    return {
      id: aisle.id,
      storeId,
      name: aisle.name,
      sortOrder: index,
      version: was === undefined ? 1 : was.version + (changed ? 1 : 0),
    };
  });
}

export function useStoresMutations(): StoresMutationsResult {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const storesKey = trpc.stores.list.queryKey();
  // Read when an action runs, before its optimistic write, never by subscribing: the store
  // manager doesn't re-render for the stores it is handed.
  const heldStores = () => queryClient.getQueryData<StoresData>(storesKey) ?? [];
  const versionOf = (stores: StoresData, storeId: string): number =>
    stores.find((store) => store.id === storeId)?.version ?? 1;
  const setStoresData = (updater: (prev: StoresData | undefined) => StoresData | undefined) =>
    queryClient.setQueryData<StoresData>(storesKey, updater);
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: storesKey });

  // Keep an optimistic update when its mutation was Queued for Replay.
  const invalidateUnlessQueued = invalidateUnlessPreserved(invalidate);

  const createMutation = useMutation(trpc.stores.create.mutationOptions());
  const { mutate: mutateCreate } = createMutation;
  const updateMutation = useMutation(trpc.stores.update.mutationOptions());
  const { mutate: mutateUpdate } = updateMutation;
  const deleteMutation = useMutation(trpc.stores.delete.mutationOptions());
  const { mutate: mutateDelete } = deleteMutation;
  const reorderMutation = useMutation(trpc.stores.reorder.mutationOptions());
  const { mutate: mutateReorder } = reorderMutation;
  const { mutateAsync: mutateCheckAsync } = useMutation(
    trpc.stores.checkSearchAddress.mutationOptions()
  );

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
        website: data.website ?? null,
        searchAddress: data.searchAddress ?? null,
        sortOrder: heldStores().length,
        version: 1,
        aisles: optimisticAisles(storeId, data.aisles ?? [], []),
      };

      setStoresData((prev) => {
        if (!prev) return [newStore];
        if (prev.some((s) => s.id === storeId)) return prev;

        return [...prev, newStore];
      });
    };

    return new Promise((resolve, reject) => {
      mutateCreate(payload, {
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
    const version = versionOf(heldStores(), data.id);

    setStoresData((prev) => {
      if (!prev) return prev;

      return prev.map((s) => {
        if (s.id !== data.id) return s;
        const { aisles, ...fields } = data;

        return {
          ...s,
          ...fields,
          // Absent, the aisles are not part of this save and stay as they are.
          aisles: aisles === undefined ? s.aisles : optimisticAisles(s.id, aisles, s.aisles),
        };
      });
    });

    mutateUpdate(
      { ...data, version },
      {
        onError: invalidateUnlessQueued,
      }
    );
  };

  const deleteStore = (storeId: string, deleteGroceries: boolean) => {
    const version = versionOf(heldStores(), storeId);
    // The Store's groceries at the versions this screen holds: the server deletes or moves only those.
    const grocerySnapshot = (
      queryClient.getQueryData<GroceriesData>(trpc.groceries.list.queryKey())?.groceries ?? []
    )
      .filter((grocery) => grocery.storeId === storeId)
      .map(({ id, version: groceryVersion }) => ({ id, version: groceryVersion }));

    setStoresData((prev) => {
      if (!prev) return prev;

      return prev.filter((s) => s.id !== storeId);
    });

    const input: StoreDeleteInput = {
      storeId,
      version,
      deleteGroceries,
      grocerySnapshot,
    };

    mutateDelete(input, {
      onError: () => invalidate(),
    });
  };

  const reorderStores = (storeIds: string[]) => {
    const held = heldStores();

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

    mutateReorder(
      {
        stores: storeIds.map((id) => ({ id, version: versionOf(held, id) })),
      },
      {
        onError: invalidateUnlessQueued,
      }
    );
  };

  /**
   * Ask a Store's shop whether Norish can search it. It never gates a save:
   * the Store is already stored by the time this is asked, and the answer
   * is something to tell the user rather than something to act on.
   */
  const checkSearchAddress = (
    storeId: string,
    term: string | null,
    searchAddress: string | null,
    website: string | null
  ): Promise<StoreSearchAddressResult> =>
    mutateCheckAsync({ storeId, term, searchAddress, website }).then((result) => {
      invalidate();

      return result;
    });

  return {
    createStore,
    updateStore,
    deleteStore,
    reorderStores,
    checkSearchAddress,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isReordering: reorderMutation.isPending,
  };
}
