"use client";

import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "../trpc";

/** A shop is asked once for a term; re-opening the picker is not a second visit. */
const SEARCH_STALE_MS = 5 * 60 * 1000;

// The input is only ever sent when both parts are real; the placeholders below
// satisfy the input's type while nothing is asked.
const searchInput = (storeId: string | null, term: string) => ({
  storeId: storeId ?? "",
  term: term.trim(),
});

/**
 * Asks a Store's own shop for a term, through the paced lookup chain. Mounted only while the
 * field asks; `useHeldShopSearch` reads the answer.
 */
export function useShopSearch(storeId: string | null, term: string): void {
  const trpc = useTRPC();

  useQuery(
    trpc.stores.searchShop.queryOptions(searchInput(storeId, term), {
      enabled: Boolean(storeId) && term.trim().length > 0,
      staleTime: SEARCH_STALE_MS,
    })
  );
}

/** What the shop answered for a term, as the cache holds it: still readable once nothing asks. */
export function useHeldShopSearch(storeId: string | null, term: string) {
  const trpc = useTRPC();

  return useQuery(
    trpc.stores.searchShop.queryOptions(searchInput(storeId, term), {
      enabled: false,
      staleTime: SEARCH_STALE_MS,
    })
  );
}

/**
 * What this Store has learned this grocery name means. The list's own prices
 * answer only for the Store each grocery sits under, so a panel where the
 * shopper has selected another Store reads its link here instead.
 */
export function useProductLink(storeId: string | null, name: string) {
  const trpc = useTRPC();
  const term = name.trim();

  return useQuery(
    trpc.stores.linkFor.queryOptions(
      { storeId: storeId ?? "", name: term },
      { enabled: Boolean(storeId) && term.length > 0, staleTime: SEARCH_STALE_MS }
    )
  );
}

/** Reads everything one Store knows it sells. Mounted only once the field was asked. */
export function useStoreProducts(storeId: string | null): void {
  const trpc = useTRPC();

  useQuery(
    trpc.stores.listProducts.queryOptions({ storeId: storeId ?? "" }, { enabled: Boolean(storeId) })
  );
}

/** What one Store sells, as the cache holds it. */
export function useHeldStoreProducts(storeId: string | null) {
  const trpc = useTRPC();

  return useQuery(
    trpc.stores.listProducts.queryOptions({ storeId: storeId ?? "" }, { enabled: false })
  );
}
