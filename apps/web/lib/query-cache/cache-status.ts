/**
 * Read-only cache introspection + the wipe-cache action for the status modal
 * (commit 9).
 *
 * The counts are derived straight from the shared QueryClient under the exact
 * keys the UI (and the Warmer) read, so they reflect what is genuinely openable
 * Offline. Wipe clears only the read cache — never the Outbox, which lives in a
 * separate object store and holds queued human intent (ADR-0001).
 */

import type { OfflineIdb } from "@/lib/offline/idb";
import type { QueryClient } from "@tanstack/react-query";
import { KEYVAL_STORE, offlineIdb } from "@/lib/offline/idb";

import type { CalendarWarmRange } from "./cache-warmer";
import { queryCacheKey } from "./cache-identity";
import { warmCalendarRanges } from "./cache-warmer";
import { clearLastWarmedAt } from "./last-warmed";
import { activeCacheOwner } from "./persisted-query-client";

export interface OfflineCacheCounts {
  /** Recipes openable in full while Offline (cached `recipes.get` entries). */
  recipes: number;
  groceries: number;
  stores: number;
  /** Planned items in the desktop "this week" window the Warmer covers. */
  plannedThisWeek: number;
}

/**
 * The `useTRPC()` query-key surface the counts need. Structural so the modal can
 * be unit-tested with a lightweight fake instead of the full router proxy.
 */
export interface CacheStatusTRPC {
  recipes: { get: { queryKey: (input: { id: string }) => readonly unknown[] } };
  groceries: { list: { queryKey: () => readonly unknown[] } };
  stores: { list: { queryKey: () => readonly unknown[] } };
  calendar: { listItems: { queryKey: (input: CalendarWarmRange) => readonly unknown[] } };
}

/** Count the per-category entries currently resident in the read cache. */
export function getOfflineCacheCounts(
  queryClient: QueryClient,
  trpc: CacheStatusTRPC
): OfflineCacheCounts {
  // Path-only prefix ([["recipes","get"]]) matches every cached single recipe,
  // derived from the tRPC helper rather than hardcoded so it can't drift.
  const recipeGetPath = [trpc.recipes.get.queryKey({ id: "" })[0]];
  const recipes = queryClient
    .getQueryCache()
    .findAll({ queryKey: recipeGetPath })
    .filter((query) => query.state.data != null).length;

  const groceriesData = queryClient.getQueryData(trpc.groceries.list.queryKey()) as
    | { groceries?: unknown[] }
    | undefined;
  const groceries = groceriesData?.groceries?.length ?? 0;

  const storesData = queryClient.getQueryData(trpc.stores.list.queryKey()) as unknown[] | undefined;
  const stores = storesData?.length ?? 0;

  // Index 0 of warmCalendarRanges() is the desktop "this week" window — the same
  // key the Warmer writes, so the count matches what was warmed.
  const desktopRange = warmCalendarRanges()[0];
  const plannedData = queryClient.getQueryData(trpc.calendar.listItems.queryKey(desktopRange)) as
    | unknown[]
    | undefined;
  const plannedThisWeek = plannedData?.length ?? 0;

  return { recipes, groceries, stores, plannedThisWeek };
}

export interface WipeReadCacheOptions {
  /** Defaults to the active cache owner. */
  ownerId?: string | null;
  idb?: OfflineIdb;
}

/**
 * Clear the persisted read cache (in-memory queries + the owner's IndexedDB blob
 * + the last-warmed stamp). The Outbox is a separate object store and is never
 * touched here — queued mutations survive a wipe (ADR-0001).
 */
export async function wipeReadCache(
  queryClient: QueryClient,
  options: WipeReadCacheOptions = {}
): Promise<void> {
  const owner = options.ownerId ?? activeCacheOwner();
  const idb = options.idb ?? offlineIdb;

  queryClient.clear();

  if (owner) {
    await idb.del(KEYVAL_STORE, queryCacheKey(owner));
    await clearLastWarmedAt(owner, idb);
  }
}
