import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { ResolvedProductLink, StoreProductDto } from "@norish/shared/contracts";
import type { EventName, PayloadOf } from "@norish/shared/contracts/realtime/catalogue";
import type { StoresRealtime } from "@norish/shared/contracts/realtime/stores";
import { isPendingLink } from "@norish/shared/lib/product-link";
import { productLinkKey } from "@norish/shared/lib/store-link-key";

import type { CreateStoresHooksOptions } from "./types";
import { useRealtimeSubscription } from "../../realtime/use-realtime-subscription";

type Payload<E extends EventName<StoresRealtime>> = PayloadOf<StoresRealtime, E>;

export type StorePricesData = ResolvedProductLink[];

/**
 * How long a Pending Link is believed on this screen. The queue answers in
 * seconds, and a job that gives up takes its row with it; a row that is still
 * pending after this is one nothing is going to answer — a worker that died
 * with it, a page that never heard the answer — and a spinner must never
 * outlive the queue. Older than this it reads as unanswered, exactly as if
 * the row were not there.
 */
export const PENDING_LINK_MAX_AGE_MS = 5 * 60 * 1000;

/**
 * What a Store knows about one Ingredient; the key every merge here uses. A
 * grocery added offline has no Ingredient until the server has resolved it,
 * and has no price until then either.
 */
export function priceKey(
  storeId: string | null,
  ingredientId: string | null | undefined
): string | null {
  return storeId && ingredientId ? productLinkKey(storeId, ingredientId) : null;
}

/** The same key, for a link. */
function linkKey(link: Pick<ResolvedProductLink, "storeId" | "ingredientId">): string {
  return productLinkKey(link.storeId, link.ingredientId);
}

/** An Ingredient a lookup is keyed by; a grocery's, or none yet. */
type IngredientKey = string | null | undefined;

export interface StorePricesResult {
  /** The Store Product a grocery's Ingredient resolves to, or null where the Store knows it as a Miss or not at all. */
  priceFor: (storeId: string | null, ingredientId: IngredientKey) => StoreProductDto | null;
  /**
   * What the Store knows about the Ingredient — a link, a Miss, or a Pending
   * Link — or null where it knows nothing. A Pending Link this screen has
   * watched for longer than the queue could take is null too.
   */
  linkFor: (storeId: string | null, ingredientId: IngredientKey) => ResolvedProductLink | null;
  isLoading: boolean;
}

interface Sighting {
  link: ResolvedProductLink;
  at: number;
}

/**
 * The valve on Pending Links: which of them this screen has watched for too
 * long. Measured from the moment each pending row was first seen here, so a
 * page that loads mid-question waits the full allowance rather than none.
 * The question asked again lands as a row identical to the one that expired,
 * which the query cache hands back as the same object, so a screen that gave
 * up on a name stays quiet until the answer lands — seconds later, as a rule.
 */
function useExpiredPendingLinks(byKey: Map<string, ResolvedProductLink>): Set<string> {
  const [expired, setExpired] = useState<Set<string>>(() => new Set());
  const [seen, setSeen] = useState<Map<string, Sighting>>(() => new Map());

  useEffect(() => {
    const now = Date.now();
    const next = new Map<string, Sighting>();
    const timers: ReturnType<typeof setTimeout>[] = [];

    for (const [key, link] of byKey) {
      if (!isPendingLink(link)) continue;
      const held = seen.get(key);
      const at = held && held.link === link ? held.at : now;

      next.set(key, { link, at });
      const left = at + PENDING_LINK_MAX_AGE_MS - now;

      if (left <= 0) continue;
      timers.push(setTimeout(() => setExpired((prev) => new Set(prev).add(key)), left));
    }

    // Only a change is worth a render: the map is rebuilt from the same rows
    // on every merge, and an identical one must not run this effect again.
    const same =
      next.size === seen.size &&
      [...next].every(([key, entry]) => {
        const before = seen.get(key);

        return before?.link === entry.link && before.at === entry.at;
      });

    if (!same) setSeen(next);
    setExpired((prev) => {
      const kept = [...prev].filter((key) => {
        const entry = next.get(key);

        return entry !== undefined && entry.at + PENDING_LINK_MAX_AGE_MS <= now;
      });

      return kept.length === prev.size ? prev : new Set(kept);
    });

    return () => timers.forEach(clearTimeout);
  }, [byKey, seen]);

  return expired;
}

export function createUseStorePrices({ useTRPC }: CreateStoresHooksOptions) {
  return function useStorePrices(): StorePricesResult {
    const trpc = useTRPC();
    const { data, isLoading } = useQuery(trpc.stores.groceryPrices.queryOptions());
    const byKey = useMemo(() => {
      const map = new Map<string, ResolvedProductLink>();

      for (const link of data ?? []) map.set(linkKey(link), link);

      return map;
    }, [data]);
    const expired = useExpiredPendingLinks(byKey);

    const linkFor = useCallback(
      (storeId: string | null, ingredientId: IngredientKey) => {
        const key = priceKey(storeId, ingredientId);
        const link = key ? (byKey.get(key) ?? null) : null;

        if (link && isPendingLink(link) && expired.has(key ?? "")) return null;

        return link;
      },
      [byKey, expired]
    );

    const priceFor = useCallback(
      (storeId: string | null, ingredientId: IngredientKey) =>
        linkFor(storeId, ingredientId)?.product ?? null,
      [linkFor]
    );

    return { priceFor, linkFor, isLoading };
  };
}

/**
 * Prices land on every screen in the household, not just the one that asked.
 * Both handlers are idempotent merges by identity — a product by its id, a
 * link by its store and Ingredient — so the actor's own echo is a no-op
 * and no echo suppression is needed anywhere.
 */
export function createUseStorePricesSubscription({ useTRPC }: CreateStoresHooksOptions) {
  return function useStorePricesSubscription() {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const queryKey = trpc.stores.groceryPrices.queryKey();
    const linkQueriesKey = trpc.stores.linkFor.queryKey();

    const setPrices = useCallback(
      (updater: (prev: StorePricesData) => StorePricesData) => {
        queryClient.setQueryData<StorePricesData>(queryKey, (prev) => updater(prev ?? []));
      },
      [queryClient, queryKey]
    );

    const lagQueryKeys = [queryKey, linkQueriesKey];

    useRealtimeSubscription<Payload<"productUpdated">>(trpc.stores.onProductUpdated, {
      onEvent: ({ product }) => {
        setPrices((prev) =>
          prev.map((link) => (link.product?.id === product.id ? { ...link, product } : link))
        );
      },
      lagQueryKeys,
    });

    useRealtimeSubscription<Payload<"linkUpdated">>(trpc.stores.onLinkUpdated, {
      onEvent: ({ link: updated }) => {
        setPrices((prev) => {
          const key = linkKey(updated);
          const without = prev.filter((link) => linkKey(link) !== key);

          return [...without, updated];
        });
        // A panel waiting on a Store the grocery does not sit under reads
        // its link on its own; the answer that just landed is its answer too.
        void queryClient.invalidateQueries({ queryKey: linkQueriesKey });
      },
      lagQueryKeys,
    });
  };
}
