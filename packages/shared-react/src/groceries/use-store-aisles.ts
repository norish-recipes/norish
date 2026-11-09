import { useCallback, useEffect, useMemo, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { AisleFiled, AisleLinkDto } from "@norish/shared/contracts";
import type { PayloadOf } from "@norish/shared/contracts/realtime/catalogue";
import type { StoresRealtime } from "@norish/shared/contracts/realtime/stores";
import { aisleLinkKey } from "@norish/shared/lib/store-link-key";

import { invalidateUnlessPreserved } from "../offline/optimistic-updates";
import { useRealtimeSubscription } from "../realtime";
import { useTRPC } from "../trpc";
import { useStoresQuery } from "./use-stores-query";

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
   * The aisle a Store files an Ingredient under, as the server answers it (its
   * own, else its nearest Parent Ingredient's), or null where the Store has
   * never been told. The
   * only place a grocery's aisle comes from: the grocery row carries none,
   * and nothing is ever guessed from words (ADR-0031). An aisle the Store no
   * longer has is no answer either, until the links are read again.
   */
  aisleFor: (storeId: string | null, ingredientId: string | null | undefined) => string | null;
  isLoading: boolean;
}

export function useStoreAisles(): StoreAislesResult {
  const trpc = useTRPC();
  const { data, isLoading } = useQuery(trpc.stores.aisleLinks.queryOptions());
  const { stores } = useStoresQuery();
  const byKey = useMemo(() => {
    const map = new Map<string, string>();

    for (const link of data ?? []) {
      map.set(aisleLinkKey(link.storeId, link.ingredientId), link.aisleId);
    }

    return map;
  }, [data]);

  // An aisle removed in the editor took its links with it on the server, by
  // cascade: the name is unfiled here until the links are read again.
  const aisleFor = useCallback(
    (storeId: string | null, ingredientId: string | null | undefined) => {
      const key = aisleKey(storeId, ingredientId);
      const aisleId = key ? (byKey.get(key) ?? null) : null;

      if (aisleId === null) return null;
      const store = stores.find((candidate) => candidate.id === storeId);

      return store?.aisles.some((aisle) => aisle.id === aisleId) ? aisleId : null;
    },
    [byKey, stores]
  );

  return { aisleFor, isLoading };
}

/** The foods on the list as one key: ticking or reordering a line leaves it as it was. */
function foodsOnTheList(groceries: Array<{ ingredientId?: string | null }>): string {
  return [...new Set(groceries.flatMap((grocery) => grocery.ingredientId ?? []))]
    .sort((a, b) => a.localeCompare(b))
    .join(",");
}

/**
 * A filing lands on every screen in the household, not just the one that
 * filed: the handler is the same idempotent merge the mutation's optimistic
 * write uses, so the actor's own echo is a no-op and nothing is suppressed.
 * The links are then read again, because a filing also moves the foods that
 * inherit it, which only the server knows.
 */
export function useStoreAislesSubscription() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const queryKey = trpc.stores.aisleLinks.queryKey();

  useRealtimeSubscription<PayloadOf<StoresRealtime, "aisleFiled">>(trpc.stores.onAisleFiled, {
    onEvent: ({ filing }) => {
      queryClient.setQueryData<StoreAislesData>(queryKey, (prev) =>
        mergeAisleFiling(prev ?? [], filing)
      );
      // The foods that are a kind of the one filed follow it, as the server says.
      void queryClient.invalidateQueries({ queryKey });
    },
    lagQueryKeys: [queryKey],
  });

  // The server answers where each food on the list is filed, a kind of a
  // food under its parent's aisle included (ADR-0037), for the foods on the
  // list when it was asked. A food new to the list is asked about again;
  // ticking or reordering changes no food and asks nothing.
  const { data: listFoods = "" } = useQuery({
    ...trpc.groceries.list.queryOptions(),
    enabled: false,
    select: (list) => foodsOnTheList(list.groceries),
  });
  const askedFoodsRef = useRef(listFoods);

  useEffect(() => {
    if (askedFoodsRef.current === listFoods) return;
    askedFoodsRef.current = listFoods;
    void queryClient.invalidateQueries({ queryKey: trpc.stores.aisleLinks.queryKey() });
  }, [listFoods, queryClient, trpc]);
}

/**
 * File a grocery's Ingredient at a Store, or under no aisle, which forgets it:
 * the one write behind the panel's Aisle field and a drop into an aisle. What
 * the Store remembers changes on this screen at once, by the same merge every
 * housemate's screen will run when the event lands, and the write goes the way
 * every grocery mutation goes — optimistic here, through the Outbox when the
 * backend is out of reach (ADR-0004), last writer winning. Nothing lives on the
 * grocery row, so there is no row to roll back: a refusal simply re-reads what
 * is filed.
 */
export function useFileGroceryName() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutate: mutateFile } = useMutation(trpc.stores.fileGroceryName.mutationOptions());

  return (
    storeId: string,
    grocery: { name: string | null; ingredientId?: string | null },
    aisleId: string | null
  ) => {
    const name = grocery.name?.trim();

    if (!name) return;
    const aisleLinksKey = trpc.stores.aisleLinks.queryKey();

    // What is filed is the grocery's Ingredient. A grocery added offline has
    // none yet; the server resolves its name, and the filing lands with the
    // echo instead.
    if (grocery.ingredientId) {
      const ingredientId = grocery.ingredientId;

      // A read already under way answers for the Store as it was; it must
      // not land over this filing. The echo reads the links again.
      void queryClient.cancelQueries({ queryKey: aisleLinksKey });
      queryClient.setQueryData<StoreAislesData>(aisleLinksKey, (prev) =>
        mergeAisleFiling(prev ?? [], { storeId, ingredientId, aisleId })
      );
    }
    mutateFile(
      { storeId, name, aisleId },
      {
        onError: invalidateUnlessPreserved(() =>
          queryClient.invalidateQueries({ queryKey: aisleLinksKey })
        ),
      }
    );
  };
}
