/** Temporary read-cache wipe retained until CacheManager owns complete reset. */

import type { OfflineIdb } from "@/lib/offline/idb";
import type { QueryClient } from "@tanstack/react-query";
import { KEYVAL_STORE, offlineIdb } from "@/lib/offline/idb";

import { queryCacheKey } from "./cache-identity";
import { clearLastWarmedAt } from "./last-warmed";
import { activeCacheOwner } from "./persisted-query-client";

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
