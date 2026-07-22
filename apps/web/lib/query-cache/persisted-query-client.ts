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
import { offlineIdb } from "@/lib/offline/idb";
import {
  persistQueryClientRestore,
  persistQueryClientSubscribe,
} from "@tanstack/query-persist-client-core";
import { QueryClient } from "@tanstack/react-query";

import type { CacheOwnerInputs } from "./cache-identity";
import {
  decideCacheOwner,
  purgeForeignCaches,
  readBootOwner,
  writeBootOwner,
} from "./cache-identity";
import { createIdbPersister } from "./idb-persister";

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
  activeOwner(): string | null;
  /**
   * Reconcile the persisted cache with the current identity. Idempotent — safe
   * to call on every identity/connectivity change; it acts only when the
   * effective owner changes. Resolves once any restore/switch has settled.
   */
  resolveOwner(inputs: Pick<CacheOwnerInputs, "sessionUserId" | "isOffline">): Promise<void>;
}

export function createCacheManager(idb: OfflineIdb): CacheManager {
  const initialBootOwner = readBootOwner();
  const persister = createIdbPersister(idb, initialBootOwner ?? ANON_OWNER);
  const queryClient = createQueryClient();

  let appliedOwner: string | null = null;
  let unsubscribe: (() => void) | null = null;
  let inFlight: Promise<void> = Promise.resolve();

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

    unsubscribe?.();
    unsubscribe = persistQueryClientSubscribe({
      queryClient,
      persister,
      buster: CACHE_BUSTER,
      dehydrateOptions: { shouldDehydrateQuery },
    });

    appliedOwner = owner;
    writeBootOwner(owner);
  }

  async function apply(
    inputs: Pick<CacheOwnerInputs, "sessionUserId" | "isOffline">
  ): Promise<void> {
    const decision = decideCacheOwner({
      bootOwner: appliedOwner ?? initialBootOwner,
      sessionUserId: inputs.sessionUserId,
      isOffline: inputs.isOffline,
    });

    if (decision.action === "wait") {
      return;
    }

    if (decision.action === "restore") {
      if (appliedOwner === decision.owner) {
        return;
      }

      await restoreForOwner(decision.owner);

      return;
    }

    // Account switch: purge the departed user's cache before adopting the new
    // one, then start the new owner from a clean in-memory client.
    if (appliedOwner === decision.to) {
      return;
    }

    if (decision.from && decision.from !== decision.to) {
      await purgeForeignCaches(idb, decision.to);
    }

    queryClient.clear();
    await restoreForOwner(decision.to);
  }

  return {
    queryClient,

    activeOwner() {
      return appliedOwner;
    },

    resolveOwner(inputs) {
      // Serialize resolutions so a rapid identity/connectivity change can't
      // interleave a restore with a switch.
      inFlight = inFlight.then(() => apply(inputs)).catch(() => undefined);

      return inFlight;
    },
  };
}

let sharedManager: CacheManager | null = null;

function manager(): CacheManager {
  if (!sharedManager) {
    sharedManager = createCacheManager(offlineIdb);
  }

  return sharedManager;
}

/** The seam handed to the provider bundle's `getQueryClient`. */
export function getPersistedQueryClient(): QueryClient {
  return manager().queryClient;
}

/** Reconcile the persisted cache with the current identity (see manager). */
export function resolveCacheOwner(
  inputs: Pick<CacheOwnerInputs, "sessionUserId" | "isOffline">
): Promise<void> {
  return manager().resolveOwner(inputs);
}

/** The active cache owner, for diagnostics and the status UI. */
export function activeCacheOwner(): string | null {
  return manager().activeOwner();
}
