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
// The leaf module, not the outbox barrel, to keep this lib-to-lib edge cycle-free.
import { runIfLeader } from "@/lib/outbox/leader";

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

type RecipeListPage = { recipes: Array<{ id: string }>; total: number; nextCursor: number | null };
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

  const ids = extractRecipeIds(data);

  await Promise.allSettled(
    ids
      .slice(0, WARM_FULL_RECIPE_COUNT)
      .map((id) =>
        queryClient.prefetchQuery(withWarmGcTime(trpc.recipes.get.queryOptions({ id })) as never)
      )
  );
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

function extractRecipeIds(data: unknown): string[] {
  const infinite = data as RecipeListInfiniteData | undefined;

  if (!infinite?.pages) {
    return [];
  }

  return infinite.pages.flatMap((page) => page.recipes.map((recipe) => recipe.id));
}
