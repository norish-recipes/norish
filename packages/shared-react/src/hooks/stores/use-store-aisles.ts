import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSubscription } from "@trpc/tanstack-react-query";

import type { AisleFiled, AisleLinkDto } from "@norish/shared/contracts";
import { aisleLinkKey, normalizeGroceryName } from "@norish/shared/lib/normalized-name";

import type { CreateStoresHooksOptions } from "./types";

export type StoreAislesData = AisleLinkDto[];

/** Where a Store files one grocery name; the key every merge here uses. */
export function aisleKey(storeId: string | null, name: string | null): string | null {
  const normalized = normalizeGroceryName(name);

  return storeId && normalized ? aisleLinkKey(storeId, normalized) : null;
}

/**
 * The one merge of a filing into what a screen holds: the entry for that
 * store and name is replaced, or removed where the Store has forgotten the
 * name. Applying the same filing twice changes nothing, which is what lets
 * the actor's own echo, a replay and a housemate's screen all run it alike.
 */
export function mergeAisleFiling(prev: StoreAislesData, filing: AisleFiled): StoreAislesData {
  const key = aisleLinkKey(filing.storeId, filing.normalizedName);
  const without = prev.filter((link) => aisleLinkKey(link.storeId, link.normalizedName) !== key);

  if (filing.aisleId === null) return without.length === prev.length ? prev : without;

  return [
    ...without,
    { storeId: filing.storeId, normalizedName: filing.normalizedName, aisleId: filing.aisleId },
  ];
}

export interface StoreAislesResult {
  /**
   * The aisle a Store files a name under, or null where the Store has never
   * been told. The only place a grocery's aisle comes from: the grocery row
   * carries none, and nothing is ever guessed from words (ADR-0031).
   */
  aisleFor: (storeId: string | null, name: string | null) => string | null;
  isLoading: boolean;
}

export function createUseStoreAisles({ useTRPC }: CreateStoresHooksOptions) {
  return function useStoreAisles(): StoreAislesResult {
    const trpc = useTRPC();
    const { data, isLoading } = useQuery(trpc.stores.aisleLinks.queryOptions());
    const byKey = useMemo(() => {
      const map = new Map<string, string>();

      for (const link of data ?? []) {
        map.set(aisleLinkKey(link.storeId, link.normalizedName), link.aisleId);
      }

      return map;
    }, [data]);

    const aisleFor = useCallback(
      (storeId: string | null, name: string | null) => {
        const key = aisleKey(storeId, name);

        return key ? (byKey.get(key) ?? null) : null;
      },
      [byKey]
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

    useSubscription(
      trpc.stores.onAisleFiled.subscriptionOptions(undefined, {
        // Typed as the transport hands it over, like every other store handler.
        onData: ({ payload }: any) => {
          const filing = payload.filing as AisleFiled;

          queryClient.setQueryData<StoreAislesData>(queryKey, (prev) =>
            mergeAisleFiling(prev ?? [], filing)
          );
        },
      })
    );
  };
}
