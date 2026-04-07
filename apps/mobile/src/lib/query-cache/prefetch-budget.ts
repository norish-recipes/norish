import type { QueryClient } from "@tanstack/react-query";

import { createClientLogger } from "@norish/shared/lib/logger";

const log = createClientLogger("prefetch-budget");

/**
 * Maximum number of recipe entries that were prefetched (not user-navigated)
 * to keep in the TanStack Query cache at any time.
 */
export const MAX_PREFETCHED_RECIPES = 30;

/**
 * Module-scoped ordered list of prefetched recipe IDs (oldest → newest).
 * Only recipes prefetched via the viewability hook are tracked here;
 * recipes loaded by direct navigation are never added.
 */
let trackedIds: string[] = [];

/** Check whether a recipe ID is already tracked as prefetched. */
export function has(id: string): boolean {
  return trackedIds.includes(id);
}

/**
 * Track a newly-prefetched recipe ID.
 * If the budget is already at capacity, the oldest entry is evicted from both
 * the tracker and the QueryClient cache.
 */
export function add(
  id: string,
  queryClient: QueryClient,
  getQueryKey: (id: string) => unknown[]
): void {
  // Deduplicate — move to end if already present (refresh LRU position).
  trackedIds = trackedIds.filter((existing) => existing !== id);
  trackedIds.push(id);

  // Evict oldest entries that exceed the budget.
  while (trackedIds.length > MAX_PREFETCHED_RECIPES) {
    const evictedId = trackedIds.shift()!;
    const queryKey = getQueryKey(evictedId);

    queryClient.removeQueries({ queryKey, exact: true });
    log.debug({ evictedId, prefetchCount: trackedIds.length }, "Evicted oldest prefetched recipe");
  }
}

/**
 * Evict **all** tracked prefetch entries from the QueryClient cache.
 * Useful for cleanup / tests. Does not touch naturally-fetched entries.
 */
export function evictAll(queryClient: QueryClient, getQueryKey: (id: string) => unknown[]): void {
  for (const id of trackedIds) {
    queryClient.removeQueries({ queryKey: getQueryKey(id), exact: true });
  }

  trackedIds = [];
}

/** Return a snapshot of the current tracked IDs (for testing / debugging). */
export function snapshot(): readonly string[] {
  return [...trackedIds];
}

/** Reset internal state (for testing). */
export function _reset(): void {
  trackedIds = [];
}
