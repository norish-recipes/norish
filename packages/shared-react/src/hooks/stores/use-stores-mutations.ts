import { useMutation, useQueryClient } from "@tanstack/react-query";

import type {
  AisleDto,
  AisleInput,
  StoreCreateDto,
  StoreDeleteInput,
  StoreDto,
  StoreSearchAddressResult,
} from "@norish/shared/contracts";
import { normalizeGroceryName } from "@norish/shared/lib/normalized-name";
import { createClientId } from "@norish/shared/lib/operation-helpers";

import type {
  CreateStoresHooksOptions,
  StoreGrocerySnapshot,
  StoresMutationsResult,
  StoresQueryResult,
  StoreUpdateDraft,
} from "./types";
import type { StoreAislesData } from "./use-store-aisles";
import {
  invalidateUnlessPreserved,
  shouldPreserveOptimisticUpdate as preserveOptimisticUpdate,
} from "../optimistic-updates";
import { mergeAisleFiling } from "./use-store-aisles";

type CreateUseStoresMutationsOptions = CreateStoresHooksOptions & {
  useStoresQuery: () => StoresQueryResult;
};

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

export function createUseStoresMutations({
  useTRPC,
  useStoresQuery,
}: CreateUseStoresMutationsOptions) {
  return function useStoresMutations(): StoresMutationsResult {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const { setStoresData, invalidate, stores } = useStoresQuery();

    const getStoreVersion = (storeId: string): number =>
      stores.find((store) => store.id === storeId)?.version ?? 1;

    // Keep an optimistic update when its mutation was Queued for Replay.
    const invalidateUnlessQueued = invalidateUnlessPreserved(invalidate);

    const createMutation = useMutation(trpc.stores.create.mutationOptions());
    const updateMutation = useMutation(trpc.stores.update.mutationOptions());
    const deleteMutation = useMutation(trpc.stores.delete.mutationOptions());
    const reorderMutation = useMutation(trpc.stores.reorder.mutationOptions());
    const checkMutation = useMutation(trpc.stores.checkSearchAddress.mutationOptions());
    const fileMutation = useMutation(trpc.stores.fileGroceryName.mutationOptions());

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
          website: data.website ?? null,
          searchAddress: data.searchAddress ?? null,
          sortOrder: stores.length,
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
      checkMutation.mutateAsync({ storeId, term, searchAddress, website }).then((result) => {
        invalidate();

        return result;
      });

    /**
     * File a grocery name at a Store: what the Store remembers changes on this
     * screen at once, by the same merge every housemate's screen will run when
     * the event lands, and the write goes the way every grocery mutation goes —
     * optimistic here, through the Outbox when the backend is out of reach
     * (ADR-0004), last writer winning. Nothing lives on the grocery row, so
     * there is no row to roll back: a refusal simply re-reads what is filed.
     */
    const fileGroceryName = (storeId: string, name: string, aisleId: string | null) => {
      const normalizedName = normalizeGroceryName(name);

      if (!normalizedName) return;
      const aisleLinksKey = trpc.stores.aisleLinks.queryKey();

      queryClient.setQueryData<StoreAislesData>(aisleLinksKey, (prev) =>
        mergeAisleFiling(prev ?? [], { storeId, normalizedName, aisleId })
      );
      fileMutation.mutate(
        { storeId, name, aisleId },
        {
          onError: invalidateUnlessPreserved(() =>
            queryClient.invalidateQueries({ queryKey: aisleLinksKey })
          ),
        }
      );
    };

    return {
      createStore,
      updateStore,
      deleteStore,
      reorderStores,
      checkSearchAddress,
      fileGroceryName,
      isCreating: createMutation.isPending,
      isUpdating: updateMutation.isPending,
      isDeleting: deleteMutation.isPending,
      isReordering: reorderMutation.isPending,
    };
  };
}
