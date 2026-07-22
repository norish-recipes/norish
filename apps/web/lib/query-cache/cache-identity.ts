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
 * This module keeps the *decision* pure and testable; side effects (localStorage
 * writes, IndexedDB purges) are separate, thin functions.
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

export interface CacheOwnerInputs {
  /** Last-known owner from `localStorage`, or null on a first-ever load. */
  bootOwner: string | null;
  /** The authenticated session user id, or null while unresolved / logged out. */
  sessionUserId: string | null;
  /** Whether connectivity has decided the backend is unreachable. */
  isOffline: boolean;
}

export type CacheOwnerDecision =
  /** Do nothing yet — online and still waiting for the session to resolve. */
  | { action: "wait" }
  /** Restore this owner's persisted cache (same user, online or offline). */
  | { action: "restore"; owner: string }
  /**
   * Adopt `to` as the owner, purging `from` first when it is a *different*
   * real user (account switch). `from` is null on first adoption (nothing to
   * purge). The freshly-adopted owner's cache is restored too (usually empty).
   */
  | { action: "switch"; from: string | null; to: string };

/**
 * Decide what to do with the persisted cache given the current identity signals.
 * Pure — the controller applies the returned action and tracks what it has
 * already committed so it never repeats work.
 */
export function decideCacheOwner({
  bootOwner,
  sessionUserId,
  isOffline,
}: CacheOwnerInputs): CacheOwnerDecision {
  if (sessionUserId) {
    // Online identity is authoritative.
    if (bootOwner === sessionUserId) {
      return { action: "restore", owner: sessionUserId };
    }

    return { action: "switch", from: bootOwner, to: sessionUserId };
  }

  // Session not yet known. Only trust the last-known owner while Offline, where
  // no other user could have logged in.
  if (isOffline && bootOwner) {
    return { action: "restore", owner: bootOwner };
  }

  return { action: "wait" };
}

// ---------------------------------------------------------------------------
// localStorage owner record (side effects)
// ---------------------------------------------------------------------------

export function readBootOwner(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const value = window.localStorage.getItem(CACHE_OWNER_STORAGE_KEY);

    return value && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

export function writeBootOwner(ownerId: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(CACHE_OWNER_STORAGE_KEY, ownerId);
  } catch {
    // Private-mode or quota failure: identity degrades to in-memory only.
  }
}

// ---------------------------------------------------------------------------
// Foreign-cache purge (side effect)
// ---------------------------------------------------------------------------

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
