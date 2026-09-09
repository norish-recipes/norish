"use client";

import { useTRPC } from "@/app/providers/trpc-provider";
import { useQuery } from "@tanstack/react-query";

/** A shop is asked once for a term; re-opening the picker is not a second visit. */
const SEARCH_STALE_MS = 5 * 60 * 1000;

/** What a Store's own shop answers for a term, read through the paced lookup chain. */
export function useShopSearch(storeId: string | null, term: string, enabled: boolean) {
  const trpc = useTRPC();

  // The input is only ever sent when both parts are real; the placeholders
  // below satisfy the input's type while the query is disabled.
  return useQuery(
    trpc.stores.searchShop.queryOptions(
      { storeId: storeId ?? "", term: term.trim() },
      { enabled: enabled && Boolean(storeId) && term.trim().length > 0, staleTime: SEARCH_STALE_MS }
    )
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

/** Everything one Store knows it sells. */
export function useStoreProducts(storeId: string | null, enabled: boolean) {
  const trpc = useTRPC();

  return useQuery(
    trpc.stores.listProducts.queryOptions(
      { storeId: storeId ?? "" },
      { enabled: enabled && Boolean(storeId) }
    )
  );
}
