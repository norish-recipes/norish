import { useCallback, useMemo } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";

import type { AisleFiled, AisleLinkDto } from "@norish/shared/contracts";
import type { PayloadOf } from "@norish/shared/contracts/realtime/catalogue";
import type { StoresRealtime } from "@norish/shared/contracts/realtime/stores";
import { aisleLinkKey } from "@norish/shared/lib/store-link-key";

import type { CreateStoresHooksOptions } from "./types";
import { useRealtimeSubscription } from "../../realtime/use-realtime-subscription";

export type StoreAislesData = AisleLinkDto[];

/**
 * Where a Store files one Ingredient; the key every merge here uses. A grocery
 * added offline has no Ingredient until the server has resolved it, and is
 * unfiled until then.
 */
export function aisleKey(
  storeId: string | null,
  ingredientId: string | null | undefined
): string | null {
  return storeId && ingredientId ? aisleLinkKey(storeId, ingredientId) : null;
}

/**
 * The one merge of a filing into what a screen holds: the entry for that
 * store and Ingredient is replaced, or removed where the Store has forgotten
 * it. Applying the same filing twice changes nothing, which is what lets the
 * actor's own echo, a replay and a housemate's screen all run it alike.
 */
export function mergeAisleFiling(prev: StoreAislesData, filing: AisleFiled): StoreAislesData {
  const key = aisleLinkKey(filing.storeId, filing.ingredientId);
  const without = prev.filter((link) => aisleLinkKey(link.storeId, link.ingredientId) !== key);

  if (filing.aisleId === null) return without.length === prev.length ? prev : without;

  return [
    ...without,
    { storeId: filing.storeId, ingredientId: filing.ingredientId, aisleId: filing.aisleId },
  ];
}

export interface StoreAislesResult {
  /**
   * The aisle a Store files an Ingredient under — its own, else the nearest
   * Parent Ingredient's — or null where the Store has never been told. The
   * only place a grocery's aisle comes from: the grocery row carries none,
   * and nothing is ever guessed from words (ADR-0031).
   */
  aisleFor: (storeId: string | null, ingredientId: string | null | undefined) => string | null;
  isLoading: boolean;
}

export function createUseStoreAisles({ useTRPC }: CreateStoresHooksOptions) {
  return function useStoreAisles(): StoreAislesResult {
    const trpc = useTRPC();
    const { data, isLoading } = useQuery(trpc.stores.aisleLinks.queryOptions());
    const byKey = useMemo(() => {
      const map = new Map<string, string>();

      for (const link of data ?? []) {
        map.set(aisleLinkKey(link.storeId, link.ingredientId), link.aisleId);
      }

      return map;
    }, [data]);

    // A child with no Aisle of its own is filed in its parent's (ADR-0037).
    // The parents asked about are those of the foods on the household's list,
    // read from wherever the list is already held; this never loads it.
    const { data: list } = useQuery({ ...trpc.groceries.list.queryOptions(), enabled: false });
    const listIngredientIds = useMemo(() => {
      const ids = new Set<string>();

      for (const grocery of list?.groceries ?? []) {
        if (grocery.ingredientId) ids.add(grocery.ingredientId);
      }

      return [...ids].sort();
    }, [list]);
    const { data: ancestors } = useQuery({
      ...trpc.ingredients.ancestors.queryOptions({ ids: listIngredientIds }),
      enabled: listIngredientIds.length > 0,
      placeholderData: keepPreviousData,
    });

    const aisleFor = useCallback(
      (storeId: string | null, ingredientId: string | null | undefined) => {
        if (!storeId || !ingredientId) return null;

        for (const id of [ingredientId, ...(ancestors?.[ingredientId] ?? [])]) {
          const filed = byKey.get(aisleLinkKey(storeId, id));

          if (filed) return filed;
        }

        return null;
      },
      [byKey, ancestors]
    );

    return { aisleFor, isLoading };
  };
}

/**
 * A filing lands on every screen in the household, not just the one that
 * filed: the handler is the same idempotent merge the mutation's optimistic
 * write uses, so the actor's own echo is a no-op and nothing is suppressed.
 */
export function createUseStoreAislesSubscription({ useTRPC }: CreateStoresHooksOptions) {
  return function useStoreAislesSubscription() {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const queryKey = trpc.stores.aisleLinks.queryKey();

    useRealtimeSubscription<PayloadOf<StoresRealtime, "aisleFiled">>(trpc.stores.onAisleFiled, {
      onEvent: ({ filing }) => {
        queryClient.setQueryData<StoreAislesData>(queryKey, (prev) =>
          mergeAisleFiling(prev ?? [], filing)
        );
      },
      lagQueryKeys: [queryKey],
    });
  };
}
