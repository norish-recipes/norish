import { useCallback, useEffect, useMemo } from "react";
import { QueryObserver, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { AisleFiled, AisleLinkDto } from "@norish/shared/contracts";
import type { PayloadOf } from "@norish/shared/contracts/realtime/catalogue";
import type { StoresRealtime } from "@norish/shared/contracts/realtime/stores";
import { aisleLinkKey } from "@norish/shared/lib/store-link-key";

import { invalidateUnlessPreserved } from "../offline/optimistic-updates";
import { writeOverRead } from "../offline/write-over-read";
import { useKeepsCurrent, useRealtimeSubscription } from "../realtime";
import { useTRPC } from "../trpc";
import { useStoresQuery } from "./use-stores-query";

export type StoreAislesData = AisleLinkDto[];

/**
 * Where a Store files one Ingredient; the key every merge here uses. A grocery
 * added offline has no Ingredient until the server has resolved it, and is
 * unfiled until then.
 */
function aisleKey(storeId: string | null, ingredientId: string | null | undefined): string | null {
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
   * The aisle a Store files an Ingredient under, its own or its nearest Parent's (ADR-0031), or
   * null where it was never told or no longer has that aisle. Nothing is guessed from words.
   */
  aisleFor: (storeId: string | null, ingredientId: string | null | undefined) => string | null;
}

export function useStoreAisles(): StoreAislesResult {
  const trpc = useTRPC();
  const { data } = useQuery(trpc.stores.aisleLinks.queryOptions());
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

  return { aisleFor };
}

/** Whether the aisle links are still on their way; a filing doesn't render its reader. */
export function useAisleLinksLoading(): boolean {
  const trpc = useTRPC();

  return useQuery(trpc.stores.aisleLinks.queryOptions()).isLoading;
}

/**
 * Where a Store files one Ingredient, as `aisleFor` answers it. Its reader re-renders only when
 * that answer changes, not for every filing in the household.
 */
export function useAisleFor(
  storeId: string | null,
  ingredientId: string | null | undefined
): string | null {
  const trpc = useTRPC();
  const key = aisleKey(storeId, ingredientId);
  const { data: aisleId = null } = useQuery({
    ...trpc.stores.aisleLinks.queryOptions(),
    select: (links) =>
      links.filter((link) => aisleLinkKey(link.storeId, link.ingredientId) === key).at(-1)
        ?.aisleId ?? null,
  });
  const { data: storeHasIt = false } = useQuery({
    ...trpc.stores.list.queryOptions(),
    select: (stores) =>
      stores.find((store) => store.id === storeId)?.aisles.some((aisle) => aisle.id === aisleId) ??
      false,
  });

  return storeHasIt ? aisleId : null;
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

  useKeepsCurrent([queryKey]);
  useRealtimeSubscription<PayloadOf<StoresRealtime, "aisleFiled">>(trpc.stores.onAisleFiled, {
    onEvent: ({ filing }) => {
      queryClient.setQueryData<StoreAislesData>(queryKey, (prev) =>
        mergeAisleFiling(prev ?? [], filing)
      );
      // The foods that are a kind of the one filed follow it, as the server says.
      void queryClient.invalidateQueries({ queryKey });
    },
    liveQueryKeys: [queryKey],
  });

  // The server answers where each food on the list is filed, a kind of a
  // food under its parent's aisle included (ADR-0037), for the foods on the
  // list when it was asked. A food new to the list is asked about again;
  // ticking or reordering changes no food and asks nothing. Watched outside
  // React, so a change to the list never renders the screen that mounts this.
  useEffect(() => {
    const foods = new QueryObserver(queryClient, {
      ...trpc.groceries.list.queryOptions(),
      enabled: false,
      select: (list) => foodsOnTheList(list.groceries),
    });
    let asked = foods.getCurrentResult().data ?? "";

    return foods.subscribe(({ data = "" }) => {
      if (data === asked) return;
      asked = data;
      void queryClient.invalidateQueries({ queryKey: trpc.stores.aisleLinks.queryKey() });
    });
  }, [queryClient, trpc]);
}

/**
 * File a grocery's Ingredient at a Store, or under no aisle to forget it: optimistic by the merge
 * the echo runs, through the Outbox while Offline (ADR-0004); a refusal reads the links again.
 */
export function useFileGroceryName() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  // In useMutation's own options: a `mutate` call's own are dropped once the next filing is sent.
  const fileOptions = trpc.stores.fileGroceryName.mutationOptions({
    onError: invalidateUnlessPreserved(
      () => void queryClient.invalidateQueries({ queryKey: trpc.stores.aisleLinks.queryKey() })
    ),
  });
  const { mutate: mutateFile } = useMutation(fileOptions);

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

      // The echo reads the links again.
      writeOverRead(queryClient, aisleLinksKey, (prev) =>
        mergeAisleFiling(prev ?? [], { storeId, ingredientId, aisleId })
      );
    }
    mutateFile({ storeId, name, aisleId });
  };
}
