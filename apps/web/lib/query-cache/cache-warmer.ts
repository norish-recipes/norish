/**
 * Cache Warmer (ADR-0001).
 *
 * While Live, tops the Offline Cache up to the guaranteed Warm Set so a
 * subsequent Offline load renders real content, not empty states:
 *
 *  - the 50 most recent recipes in full (each with its primary image),
 *  - all groceries and recurring groceries, and all stores,
 *  - the calendar's initial view window (both the desktop week and the wider
 *    mobile window, so whichever layout the device renders is covered).
 *
 * The Warmer prefetches through the normal query layer using the provider's own
 * QueryClient and `useTRPC` proxy, so warmed entries land under the exact keys
 * the UI reads. Recipe-list filters are reproduced from the same canonical
 * default the dashboard uses, never hardcoded, so the warmed list key matches.
 *
 * Warm entries are given a long `gcTime` so they stay resident (and thus keep
 * getting persisted) rather than being garbage-collected between visits.
 */

import type { QueryClient } from "@tanstack/react-query";
import { getInitialDateRange } from "@/app/(app)/calendar/context-helpers";
import {
  IMAGE_CACHE_MAX_AGE_SECONDS,
  IMAGE_CACHE_MAX_ENTRIES,
  IMAGE_CACHE_NAME,
} from "@/lib/offline/cache-names";
// The leaf module, not the outbox barrel, to keep this lib-to-lib edge cycle-free.
import { runIfLeader } from "@/lib/outbox/leader";
import { CacheExpiration } from "serwist";

import { DEFAULT_RECIPE_FILTERS, toRecipesQueryFilters } from "@norish/shared-react/contexts";
import { dateKey } from "@norish/shared/lib/helpers";

import { writeLastWarmedAt } from "./last-warmed";
import { activeCacheOwner, CACHE_MAX_AGE_MS } from "./persisted-query-client";

/** Page size for the recipe-list warm; matches the dashboard hook's default. */
export const WARM_RECIPE_LIST_LIMIT = 100;

/** Guaranteed floor of recipes warmed in full (ADR / Warm Set glossary). */
export const WARM_FULL_RECIPE_COUNT = 50;

/**
 * The exact `recipes.list` input the dashboard uses with no filters applied.
 * Derived from the shared canonical filter defaults so the warmed infinite-query
 * key is identical to the one the grid reads — a hardcoded copy would drift
 * (e.g. the real default `filterMode` is "AND", not the hook's "OR" fallback).
 */
export function warmRecipeListInput() {
  return {
    limit: WARM_RECIPE_LIST_LIMIT,
    ...toRecipesQueryFilters(DEFAULT_RECIPE_FILTERS),
  };
}

export interface CalendarWarmRange {
  startISO: string;
  endISO: string;
}

/**
 * Calendar ranges to warm: the desktop week and the wider mobile window. Both
 * are derived from the calendar UI's own {@link getInitialDateRange} helper so
 * range math is never duplicated, then keyed with the same {@link dateKey} the
 * view applies before querying.
 */
export function warmCalendarRanges(): CalendarWarmRange[] {
  return (["desktop", "mobile"] as const).map((mode) => {
    const { start, end } = getInitialDateRange(mode);

    return { startISO: dateKey(start), endISO: dateKey(end) };
  });
}

/**
 * The `useTRPC()` proxy surface the Warmer needs. Kept structural so the Warmer
 * can be unit-tested with a lightweight fake rather than the full router proxy.
 */
export interface WarmerTRPC {
  recipes: {
    list: {
      infiniteQueryOptions: (
        input: ReturnType<typeof warmRecipeListInput>,
        opts: { getNextPageParam: (lastPage: RecipeListPage) => number | null }
      ) => object;
    };
    get: {
      queryOptions: (input: { id: string }) => object;
    };
  };
  groceries: { list: { queryOptions: () => object } };
  stores: { list: { queryOptions: () => object } };
  calendar: {
    listItems: {
      queryOptions: (input: CalendarWarmRange) => object;
    };
  };
}

type RecipeListItem = { id: string; image?: string | null };
type RecipeListPage = { recipes: RecipeListItem[]; total: number; nextCursor: number | null };
type RecipeListInfiniteData = { pages: RecipeListPage[] };

export interface WarmCacheOptions {
  trpc: WarmerTRPC;
  queryClient: QueryClient;
}

/** Attach the Warm Set `gcTime` to a query-options object. */
function withWarmGcTime<T extends object>(options: T): T {
  return { ...options, gcTime: CACHE_MAX_AGE_MS };
}

/**
 * Warm the entire Warm Set. Individual prefetches are isolated so one failure
 * (or an Offline transition mid-warm) never aborts the rest.
 */
export async function warmCache({ trpc, queryClient }: WarmCacheOptions): Promise<void> {
  await Promise.allSettled([warmRecipes(trpc, queryClient), warmLists(trpc, queryClient)]);
}

async function warmRecipes(trpc: WarmerTRPC, queryClient: QueryClient): Promise<void> {
  const listOptions = withWarmGcTime(
    trpc.recipes.list.infiniteQueryOptions(warmRecipeListInput(), {
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    })
  );

  // Fetch (not just prefetch) the list so we can read back the ids of the most
  // recent recipes and warm each in full.
  const data = await queryClient.fetchInfiniteQuery(listOptions as never).catch(() => undefined);

  const warmSetRecipes = extractRecipeListItems(data).slice(0, WARM_FULL_RECIPE_COUNT);

  await Promise.allSettled([
    ...warmSetRecipes.map(({ id }) =>
      queryClient.prefetchQuery(withWarmGcTime(trpc.recipes.get.queryOptions({ id })) as never)
    ),
    warmPrimaryImages(warmSetRecipes),
  ]);
}

/**
 * Fetch each warmed recipe's canonical primary image into the bounded runtime
 * image cache the service worker reads (ADR-0009), so warmed recipe cards and
 * details keep their essential visual context on a backend-down load. Only
 * same-origin images qualify — the worker's image route caches nothing else —
 * and every media failure is isolated. Gallery, step, and video media stay
 * best-effort by design.
 */
async function warmPrimaryImages(recipes: RecipeListItem[]): Promise<void> {
  if (typeof caches === "undefined" || typeof fetch !== "function") {
    return;
  }

  const urls = recipes
    .map((recipe) => resolveSameOriginImageUrl(recipe.image))
    .filter((url): url is string => url !== null);

  if (urls.length === 0) {
    return;
  }

  try {
    const cache = await caches.open(IMAGE_CACHE_NAME);
    const expiration = new CacheExpiration(IMAGE_CACHE_NAME, {
      maxEntries: IMAGE_CACHE_MAX_ENTRIES,
      maxAgeSeconds: IMAGE_CACHE_MAX_AGE_SECONDS,
    });

    await Promise.allSettled(
      urls.map(async (url) => {
        if (await cache.match(url)) {
          await expiration.updateTimestamp(url);

          return;
        }

        const response = await fetch(url);

        if (response.ok) {
          await cache.put(url, response);
          await expiration.updateTimestamp(url);
        }
      })
    );
    await expiration.expireEntries();
  } catch {
    // Cache Storage refused entirely (e.g. storage pressure) — the query-layer
    // Warm Set must still land, so image warming never propagates a failure.
  }
}

function resolveSameOriginImageUrl(image: string | null | undefined): string | null {
  if (!image || typeof location === "undefined") {
    return null;
  }

  try {
    const url = new URL(image, location.href);

    return url.origin === location.origin ? url.toString() : null;
  } catch {
    return null;
  }
}

async function warmLists(trpc: WarmerTRPC, queryClient: QueryClient): Promise<void> {
  const prefetches: Array<Promise<unknown>> = [
    queryClient.prefetchQuery(withWarmGcTime(trpc.groceries.list.queryOptions()) as never),
    queryClient.prefetchQuery(withWarmGcTime(trpc.stores.list.queryOptions()) as never),
    ...warmCalendarRanges().map((range) =>
      queryClient.prefetchQuery(
        withWarmGcTime(trpc.calendar.listItems.queryOptions(range)) as never
      )
    ),
  ];

  await Promise.allSettled(prefetches);
}

export interface TopUpWarmSetOptions {
  /**
   * The `useTRPC()` proxy. Accepted as `unknown` and narrowed once here, so call
   * sites don't each repeat the structural cast; tests can pass a fake
   * satisfying {@link WarmerTRPC} directly.
   */
  trpc: unknown;
  queryClient: QueryClient;
}

/**
 * Leader-gated Warm Set top-up plus the last-warmed stamp, as one unit.
 *
 * Every warm call site (the reconnect path in `offline-cache-controller`, the
 * status modal's Sync-now and wipe-then-rewarm) goes through here so the status
 * modal's "data from X ago" line can never drift from an actual warm: the stamp
 * is written exactly where warmCache ran — the leader tab. A non-leader tab
 * skips both and reads the leader's stamp back from the shared IndexedDB store.
 */
export async function topUpWarmSet({ trpc, queryClient }: TopUpWarmSetOptions): Promise<void> {
  await runIfLeader(async () => {
    await warmCache({ trpc: trpc as WarmerTRPC, queryClient });

    const owner = activeCacheOwner();

    if (owner) {
      await writeLastWarmedAt(owner, Date.now());
    }
  });
}

function extractRecipeListItems(data: unknown): RecipeListItem[] {
  const infinite = data as RecipeListInfiniteData | undefined;

  if (!infinite?.pages) {
    return [];
  }

  return infinite.pages.flatMap((page) => page.recipes);
}
