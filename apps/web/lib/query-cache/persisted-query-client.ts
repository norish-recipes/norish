/**
 * The web app's persisted, per-user QueryClient (ADR-0001, ADR-0005).
 *
 * A single QueryClient is created at module load and injected into the shared
 * provider bundle via its `getQueryClient` seam — the same seam the mobile app
 * uses. Persistence is deferred until an owner is confirmed (see
 * {@link ./cache-identity}); restoration then hydrates that owner's cache from
 * IndexedDB and a subscription keeps it saved. On an account switch the departed
 * owner's cache is purged, the client is cleared, and the persister re-keyed.
 *
 * The manager is a factory so tests can drive it against `fake-indexeddb`; the
 * app shares the module-level default.
 */

import type { OfflineIdb } from "@/lib/offline/idb";
import { deleteImageCache } from "@/lib/offline/cache-names";
import { KEYVAL_STORE, offlineIdb } from "@/lib/offline/idb";
import {
  persistQueryClientRestore,
  persistQueryClientSubscribe,
} from "@tanstack/query-persist-client-core";
import { QueryClient } from "@tanstack/react-query";

import { CACHE_OWNER_STORAGE_KEY, purgeForeignCaches, queryCacheKey } from "./cache-identity";
import { createIdbPersister } from "./idb-persister";
import { clearLastWarmedAt } from "./last-warmed";

/** Discard a restored cache older than this (ADR: 7-day maxAge). */
export const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Cache buster — a restored cache from a different app version is dropped
 * wholesale rather than migrated, so a schema change can never surface stale
 * shapes. Human intent in the Outbox is busted separately (never here).
 */
// NEXT_PUBLIC values are intentionally exposed to the browser by Next.js.
// eslint-disable-next-line no-restricted-properties
export const CACHE_BUSTER = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";

/** Placeholder owner before any user is confirmed; never actually persisted. */
const ANON_OWNER = "__anon__";

function readBootOwner(): string | null {
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

function writeBootOwner(ownerId: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(CACHE_OWNER_STORAGE_KEY, ownerId);
  } catch {
    // Private-mode or quota failure: identity degrades to in-memory only.
  }
}

/** Only fully-successful queries are worth persisting for offline reads. */
const shouldDehydrateQuery = (query: { state: { status: string } }) =>
  query.state.status === "success";

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5,
        gcTime: 1000 * 60 * 10,
        refetchOnWindowFocus: true,
        refetchOnMount: "always",
        retry: 1,
      },
      mutations: {
        // Our "offline" is backend-unreachable, not `navigator.onLine`, so a
        // mutation must always fire and be allowed to fail — that failure is
        // what the Outbox link captures for Replay. Retrying is the Outbox's
        // job, never React Query's.
        networkMode: "always",
        retry: 0,
      },
    },
  });
}

export interface CacheManager {
  readonly queryClient: QueryClient;
  /** The owner whose cache is currently restored, or null before any restore. */
  owner(): string | null;
  /**
   * Reconcile the persisted cache with the current identity. Idempotent — safe
   * to call on every identity/connectivity change; it acts only when the
   * effective owner changes. Resolves once any restore/switch has settled.
   */
  reconcileIdentity(inputs: { sessionUserId: string | null; isOffline: boolean }): Promise<void>;
  /** Clear the complete local read copy without touching queued mutations or the app shell. */
  resetOfflineCopy(cause: "manual" | "sign-out"): Promise<void>;
  /** Observe the one applied-owner value. */
  subscribe(listener: () => void): () => void;
}

export function createCacheManager(idb: OfflineIdb): CacheManager {
  let bootOwner = readBootOwner();
  const persister = createIdbPersister(idb, bootOwner ?? ANON_OWNER);
  const queryClient = createQueryClient();

  let appliedOwner: string | null = null;
  let unsubscribe: (() => void) | null = null;
  let inFlight: Promise<void> = Promise.resolve();
  const appliedListeners = new Set<() => void>();

  function subscribeToPersistence(): void {
    unsubscribe?.();
    unsubscribe = persistQueryClientSubscribe({
      queryClient,
      persister,
      buster: CACHE_BUSTER,
      dehydrateOptions: { shouldDehydrateQuery },
    });
  }

  function notifyOwnerApplied(): void {
    for (const listener of appliedListeners) {
      listener();
    }
  }

  async function restoreForOwner(owner: string): Promise<void> {
    persister.setOwner(owner);

    await persistQueryClientRestore({
      queryClient,
      persister,
      maxAge: CACHE_MAX_AGE_MS,
      buster: CACHE_BUSTER,
      // Dehydration drops per-query gcTime, so without a hydrate-time floor every
      // restored entry — warmed ones included — reverts to the 10-minute default,
      // is GC'd shortly after boot, and falls out of the next persist snapshot: a
      // warmed recipe would not survive a second Offline reload (ADR-0008's
      // durability claim). Restoring at the cache's own maxAge keeps anything
      // persisted eligible to stay persisted for as long as the on-disk copy is
      // itself valid; the whole-cache maxAge/buster still bound staleness.
      hydrateOptions: { defaultOptions: { queries: { gcTime: CACHE_MAX_AGE_MS } } },
    });

    subscribeToPersistence();

    appliedOwner = owner;
    bootOwner = owner;
    writeBootOwner(owner);
    notifyOwnerApplied();
  }

  async function applyIdentity({
    sessionUserId,
    isOffline,
  }: {
    sessionUserId: string | null;
    isOffline: boolean;
  }): Promise<void> {
    const knownOwner = appliedOwner ?? bootOwner;
    const nextOwner = sessionUserId ?? (isOffline ? knownOwner : null);

    if (!nextOwner || appliedOwner === nextOwner) {
      return;
    }

    // Account switch: purge the departed user's reads and personalized images
    // before adopting the new one, then start the new owner from a clean
    // in-memory client. The departed user's Outbox is deliberately untouched —
    // it stays dormant under its owner (ADR-0009).
    if (knownOwner && knownOwner !== nextOwner) {
      await purgeForeignCaches(idb, nextOwner);
      await deleteImageCache();
    }

    if (!knownOwner || knownOwner !== nextOwner) {
      queryClient.clear();
    }

    await restoreForOwner(nextOwner);
  }

  return {
    queryClient,

    owner() {
      return appliedOwner;
    },

    reconcileIdentity(inputs) {
      // Serialize resolutions so a rapid identity/connectivity change can't
      // interleave a restore with a switch.
      inFlight = inFlight.then(() => applyIdentity(inputs)).catch(() => undefined);

      return inFlight;
    },

    resetOfflineCopy(cause) {
      inFlight = inFlight
        .then(async () => {
          const owner = appliedOwner ?? bootOwner;

          unsubscribe?.();
          unsubscribe = null;
          queryClient.clear();

          await Promise.all([
            owner ? idb.del(KEYVAL_STORE, queryCacheKey(owner)) : Promise.resolve(),
            owner ? clearLastWarmedAt(owner, idb) : Promise.resolve(),
            deleteImageCache(),
          ]);

          if (cause === "sign-out") {
            appliedOwner = null;
            bootOwner = null;

            try {
              window.localStorage.removeItem(CACHE_OWNER_STORAGE_KEY);
            } catch {
              // Private-mode storage failures degrade to the in-memory reset.
            }

            notifyOwnerApplied();

            return;
          }

          if (owner) {
            persister.setOwner(owner);
            subscribeToPersistence();
          }
        })
        .catch(() => undefined);

      return inFlight;
    },

    subscribe(listener) {
      appliedListeners.add(listener);

      return () => {
        appliedListeners.delete(listener);
      };
    },
  };
}

export const cacheManager = createCacheManager(offlineIdb);

/** The seam handed to the provider bundle's `getQueryClient`. */
export function getPersistedQueryClient(): QueryClient {
  return cacheManager.queryClient;
}
