/**
 * Per-user identity for the Offline Cache (ADR-0005).
 *
 * Personalized read artifacts are keyed per user id and purged on account
 * switch, so a second user on the same browser never boots into the first
 * user's hydrated household view. The Outbox has a separate owner-scoped
 * lifecycle and remains dormant across a switch. The tricky part is *offline*
 * boot: the live session can only be confirmed by reaching the backend, so on a
 * backend-down load there is no authoritative identity. We therefore persist
 * the last-known owner id (the storage adapter's `lastOwner`, readable without
 * the backend) and gate restoration on it:
 *
 *  - Online, the session is authoritative — restore only the confirmed user, so
 *    a different user logging in never sees the previous user's data.
 *  - Offline, no login is possible (it needs the backend), so the last-known
 *    owner is necessarily the returning user: restore it (device possession =
 *    read access).
 *
 * CacheManager owns the identity decision and last-owner lifecycle. This file
 * only supplies its persisted-key mechanics.
 */

import type { OfflineStorage } from "./storage";

/** Prefix for an owner's persisted reads in the `keyval` store, one entry per read. */
const QUERY_CACHE_KEY_PREFIX = "query-cache:";
const LAST_WARMED_KEY_PREFIX = "last-warmed:";
const OWNER_DATA_KEY_PREFIX = "owner-data:";

/** The start of every `keyval` key holding one of `ownerId`'s persisted reads. */
export function queryCachePrefix(ownerId: string): string {
  return `${QUERY_CACHE_KEY_PREFIX}${ownerId}`;
}

/** `keyval` key under which one of `ownerId`'s reads lives, by its query hash. */
export function queryCacheKey(ownerId: string, queryHash: string): string {
  return `${queryCachePrefix(ownerId)}:${queryHash}`;
}

/** `keyval` key holding a given owner's Warm Set completion time. */
export function lastWarmedKey(ownerId: string): string {
  return `${LAST_WARMED_KEY_PREFIX}${ownerId}`;
}

/** The start of every `keyval` key holding a named value one of `ownerId`'s screens keeps. */
export function ownerDataPrefix(ownerId: string): string {
  return `${OWNER_DATA_KEY_PREFIX}${ownerId}:`;
}

/** `keyval` key under which `ownerId`'s value `name` lives. */
export function ownerDataKey(ownerId: string, name: string): string {
  return `${ownerDataPrefix(ownerId)}${name}`;
}

function ownerFromPrefixedKey(key: unknown, prefix: string): string | null {
  if (typeof key !== "string" || !key.startsWith(prefix)) {
    return null;
  }

  const owner = key.slice(prefix.length);

  return owner.length > 0 ? owner : null;
}

/** The owner id of a key that holds `<prefix><owner>:<rest>`, or null if the key isn't one. */
function ownerBeforeColon(key: unknown, prefix: string): string | null {
  const owner = ownerFromPrefixedKey(key, prefix)?.split(":", 1)[0];

  return owner ? owner : null;
}

/** Extract the owner id from a `queryCacheKey`, or null if the key isn't one. */
export function ownerFromCacheKey(key: unknown): string | null {
  return ownerBeforeColon(key, QUERY_CACHE_KEY_PREFIX);
}

/**
 * Remove every persisted read artifact in storage that does not belong to
 * `keepOwnerId`. Best-effort: a failure here must not block the app from
 * starting.
 */
export async function purgeForeignReadArtifacts(
  keyval: OfflineStorage["keyval"],
  keepOwnerId: string
): Promise<void> {
  try {
    const keys = await keyval.keys();

    await Promise.all(
      keys.map(async (key) => {
        const owner =
          ownerFromCacheKey(key) ??
          ownerFromPrefixedKey(key, LAST_WARMED_KEY_PREFIX) ??
          ownerBeforeColon(key, OWNER_DATA_KEY_PREFIX);

        if (owner && owner !== keepOwnerId) {
          await keyval.del(key);
        }
      })
    );
  } catch {
    // Ignore — leaving a stale foreign cache is preferable to a boot failure.
  }
}
