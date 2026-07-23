/**
 * TanStack Query {@link Persister} backed by the offline IndexedDB `keyval`
 * store, scoped to one cache owner at a time (ADR-0005).
 *
 * The owner is mutable so an account switch can re-point the persister at the
 * new user's key without tearing down the QueryClient: subsequent saves land
 * under the new key, and the departed owner's blob is purged separately (see
 * {@link ../query-cache/cache-identity#purgeForeignReadArtifacts}).
 *
 * Every operation is best-effort — a persistence failure must degrade to an
 * in-memory cache, never crash a render.
 */

import type { OfflineIdb } from "@/lib/offline/idb";
import type { PersistedClient, Persister } from "@tanstack/query-persist-client-core";
import { KEYVAL_STORE } from "@/lib/offline/idb";

import { queryCacheKey } from "./cache-identity";

export interface OwnerScopedPersister extends Persister {
  /** Re-point persistence at another owner's cache key. */
  setOwner(ownerId: string): void;
  /** The owner this persister currently reads and writes. */
  currentOwner(): string;
}

export function createIdbPersister(idb: OfflineIdb, initialOwnerId: string): OwnerScopedPersister {
  let ownerId = initialOwnerId;
  let key = queryCacheKey(ownerId);

  return {
    setOwner(nextOwnerId: string) {
      ownerId = nextOwnerId;
      key = queryCacheKey(nextOwnerId);
    },

    currentOwner() {
      return ownerId;
    },

    async persistClient(client: PersistedClient) {
      try {
        await idb.set(KEYVAL_STORE, key, client);
      } catch {
        // Ignore — the cache simply stays in memory this session.
      }
    },

    async restoreClient() {
      try {
        return await idb.get<PersistedClient>(KEYVAL_STORE, key);
      } catch {
        return undefined;
      }
    },

    async removeClient() {
      try {
        await idb.del(KEYVAL_STORE, key);
      } catch {
        // Ignore — a stale blob is harmless; maxAge/buster will discard it.
      }
    },
  };
}
