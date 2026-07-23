/**
 * Per-user identity for the Offline Cache (ADR-0005).
 *
 * The cache and Outbox are keyed per user id and purged on account switch, so a
 * second user on the same browser never boots into the first user's hydrated
 * household view. The tricky part is *offline* boot: the live session can only
 * be confirmed by reaching the backend, so on a backend-down load there is no
 * authoritative identity. We therefore persist the last-known owner id in
 * `localStorage` (readable without the backend) and gate restoration on it:
 *
 *  - Online, the session is authoritative — restore only the confirmed user, so
 *    a different user logging in never sees the previous user's data.
 *  - Offline, no login is possible (it needs the backend), so the last-known
 *    owner is necessarily the returning user: restore it (device possession =
 *    read access).
 *
 * CacheManager owns the identity decision and localStorage lifecycle. This file
 * only supplies its persisted-key mechanics.
 */

import type { OfflineIdb } from "@/lib/offline/idb";
import { KEYVAL_STORE } from "@/lib/offline/idb";

/** `localStorage` key holding the last-known cache owner id. */
export const CACHE_OWNER_STORAGE_KEY = "norish.offline.cache-owner";

/** Prefix for a per-owner persisted query-cache blob in the `keyval` store. */
export const QUERY_CACHE_KEY_PREFIX = "query-cache:";

/** IndexedDB `keyval` key under which a given owner's dehydrated cache lives. */
export function queryCacheKey(ownerId: string): string {
  return `${QUERY_CACHE_KEY_PREFIX}${ownerId}`;
}

/** Extract the owner id from a `queryCacheKey`, or null if the key isn't one. */
export function ownerFromCacheKey(key: unknown): string | null {
  if (typeof key !== "string" || !key.startsWith(QUERY_CACHE_KEY_PREFIX)) {
    return null;
  }

  const owner = key.slice(QUERY_CACHE_KEY_PREFIX.length);

  return owner.length > 0 ? owner : null;
}

/**
 * Remove every persisted query cache in IndexedDB that does not belong to
 * `keepOwnerId`. Used when an account switch is detected so a departed user's
 * hydrated data does not linger on the device. Best-effort: a failure here must
 * not block the app from starting.
 */
export async function purgeForeignCaches(idb: OfflineIdb, keepOwnerId: string): Promise<void> {
  try {
    const keys = await idb.keys(KEYVAL_STORE);

    await Promise.all(
      keys.map(async (key) => {
        const owner = ownerFromCacheKey(key);

        if (owner && owner !== keepOwnerId) {
          await idb.del(KEYVAL_STORE, key);
        }
      })
    );
  } catch {
    // Ignore — leaving a stale foreign cache is preferable to a boot failure.
  }
}
