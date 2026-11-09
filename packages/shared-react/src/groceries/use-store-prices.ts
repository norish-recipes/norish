import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { ResolvedProductLink, StoreProductDto } from "@norish/shared/contracts";
import type { EventName, PayloadOf } from "@norish/shared/contracts/realtime/catalogue";
import type { StoresRealtime } from "@norish/shared/contracts/realtime/stores";
import { isPendingLink } from "@norish/shared/lib/product-link";
import { productLinkKey } from "@norish/shared/lib/store-link-key";

import { useRealtimeSubscription } from "../realtime";
import { useTRPC } from "../trpc";

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
function priceKey(storeId: string | null, ingredientId: string | null | undefined): string | null {
  return storeId && ingredientId ? productLinkKey(storeId, ingredientId) : null;
}

/** The same key, for a link. */
function linkKey(link: Pick<ResolvedProductLink, "storeId" | "ingredientId">): string {
  return productLinkKey(link.storeId, link.ingredientId);
}

/** An Ingredient a lookup is keyed by; a grocery's, or none yet. */
type IngredientKey = string | null | undefined;

/** The Store Product a grocery's Ingredient resolves to, or null where the Store knows it as a Miss or not at all. */
export type PriceFor = (
  storeId: string | null,
  ingredientId: IngredientKey
) => StoreProductDto | null;

function priceForIn(links: StorePricesData): PriceFor {
  const byKey = new Map(links.map((link) => [linkKey(link), link.product ?? null]));

  return (storeId, ingredientId) => {
    const key = priceKey(storeId, ingredientId);

    return (key ? byKey.get(key) : null) ?? null;
  };
}

/** A reading of the prices, such as one Store's total: its reader re-renders only when it changes. */
export function useStorePrices<T>(read: (priceFor: PriceFor) => T): T | undefined {
  const trpc = useTRPC();
  const { data } = useQuery({
    ...trpc.stores.groceryPrices.queryOptions(),
    select: (links) => read(priceForIn(links)),
  });

  return data;
}

/**
 * What the Store knows about one Ingredient — a link, a Miss, or a Pending
 * Link — or null where it knows nothing. Its reader re-renders only when that
 * link changes.
 *
 * The valve on a Pending Link: one this screen has watched for longer than the
 * queue could take reads as null too, measured from the moment it was first
 * seen here, so a page that loads mid-question waits the full allowance rather
 * than none. The question asked again lands as a row identical to the one that
 * expired, which the query cache hands back as the same object, so a screen
 * that gave up on a name stays quiet until the answer lands. Any other row is
 * waited on afresh.
 */
export function useLinkFor(
  storeId: string | null,
  ingredientId: IngredientKey
): ResolvedProductLink | null {
  const trpc = useTRPC();
  const key = priceKey(storeId, ingredientId);
  const { data: link = null } = useQuery({
    ...trpc.stores.groceryPrices.queryOptions(),
    select: (links) => links.filter((candidate) => linkKey(candidate) === key).at(-1) ?? null,
  });
  const [expired, setExpired] = useState<ResolvedProductLink | null>(null);

  useEffect(() => {
    if (!isPendingLink(link)) return;
    const timer = setTimeout(() => setExpired(link), PENDING_LINK_MAX_AGE_MS);

    return () => clearTimeout(timer);
  }, [link]);

  return link !== null && link === expired ? null : link;
}

/**
 * Prices land on every screen in the household, not just the one that asked.
 * Both handlers are idempotent merges by identity — a product by its id, a
 * link by its store and Ingredient — so the actor's own echo is a no-op
 * and no echo suppression is needed anywhere.
 */
export function useStorePricesSubscription() {
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
}
