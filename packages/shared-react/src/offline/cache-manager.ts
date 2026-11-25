// The engine's persisted, per-owner QueryClient (ADR-0001, ADR-0005): it persists only once an
// owner is confirmed, and an account switch purges the departed owner's cache and re-keys.

import type { Query } from "@tanstack/react-query";
import {
  dehydrate,
  hydrate,
  partialMatchKey,
  QueryCache,
  QueryClient,
} from "@tanstack/react-query";
import { createTRPCClient } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";

import type { LibraryListInput } from "@norish/shared/contracts/list-queries";
import type { AppRouter } from "@norish/trpc/client";
import { isSearchListInput } from "@norish/shared/contracts/list-queries";

import type { OfflineStorage } from "./storage";
import { isNotFoundError } from "../trpc/not-found";
import { ownerDataKey, ownerDataPrefix, purgeForeignReadArtifacts } from "./cache-identity";
import { clearLastWarmedAt } from "./last-warmed";
import { createQueryStore } from "./persister";
import { shareEqual } from "./share-equal";

/** Discard a restored cache older than this (ADR: 7-day maxAge). */
export const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export const QUERY_STALE_TIME_MS = 1000 * 60 * 5;

/** A burst of changes saves once, this long after its first change. */
export const PERSIST_THROTTLE_MS = 1000;

/** Runs `run` when the thread is next idle (or within the throttle at the latest). */
const whenIdle = (run: () => void) => {
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(run, { timeout: PERSIST_THROTTLE_MS });
  } else {
    setTimeout(run, 0);
  }
};

/** A clear waits at most this long for owner-data writes still landing. */
export const OWNER_WRITE_WAIT_MS = 250;

export type RefetchOnMount = boolean | "always" | ((query: Query) => boolean | "always");

// Names tRPC's path keys; it never sends a request or touches a client.
const keys = createTRPCOptionsProxy<AppRouter>({
  client: createTRPCClient<AppRouter>({ links: [] }),
  queryClient: () => new QueryClient(),
});

/**
 * Reads never written to storage: admin reads hold other users' details and, in a query's input, a
 * key being typed; the CalDAV password is a decrypted secret and its connection check a live probe.
 */
const NEVER_PERSISTED = [
  keys.admin.pathKey(),
  keys.caldav.getPassword.pathKey(),
  keys.caldav.checkConnection.pathKey(),
  // Keyed by what is typed in Search, which is never kept (CONTEXT.md: Recent Search).
  keys.library.suggest.pathKey(),
];

/** Search's own Library reads, keyed by its text like the suggestions. */
const isSearchListRead = (queryKey: readonly unknown[]) =>
  partialMatchKey(queryKey, keys.library.list.pathKey()) &&
  isSearchListInput((queryKey[1] as { input?: Partial<LibraryListInput> } | undefined)?.input);

/** Persist usable read data even when its latest background refetch failed. */
const shouldDehydrateQuery = (query: { queryKey: readonly unknown[]; state: { data: unknown } }) =>
  query.state.data !== undefined &&
  !NEVER_PERSISTED.some((key) => partialMatchKey(query.queryKey, key)) &&
  !isSearchListRead(query.queryKey);

/** The engine's QueryClient defaults; a client renders its server pass with its own copy. */
export function createOfflineQueryClient({
  refetchOnMount = true,
}: { refetchOnMount?: RefetchOnMount } = {}): QueryClient {
  const queryClient = new QueryClient({
    queryCache: new QueryCache({
      // A refused read keeps no copy, here or stored: after a policy or membership change too.
      onError: (error, query) => {
        if (isNotFoundError(error) && query.state.data !== undefined) {
          query.setState({ data: undefined, dataUpdatedAt: 0 });
        }
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: QUERY_STALE_TIME_MS,
        gcTime: 1000 * 60 * 10,
        refetchOnWindowFocus: true,
        refetchOnMount,
        retry: 1,
        // Keeps an unchanged object across a refetch even when it holds a Date.
        structuralSharing: shareEqual,
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

  // Defaults are read when a query is built, so registering them here, before
  // any read or restore, gives every such entry the offline cache's lifetime
  // however it got in: the Warm Set, the page the reader opened, or the seed a
  // create writes Live or Offline.
  // The reads a reader opens or makes that must outlive a trip Offline: a recipe
  // and a cookbook (ADR-0008). tRPC builds their path keys, so each matches every id.
  for (const pathKey of [
    keys.recipes.get.pathKey(),
    keys.cookbooks.get.pathKey(),
    // And the groceries list's reads, which no observer holds while the Pantry view shows.
    keys.groceries.list.pathKey(),
    keys.stores.list.pathKey(),
    keys.stores.groceryPrices.pathKey(),
    keys.stores.aisleLinks.pathKey(),
    // And a surface's previous icons read, which its icons show while a changed set is read.
    keys.ingredients.icons.pathKey(),
    // And the Library's grid, which no observer holds through a long cooking session.
    keys.library.list.pathKey(),
    // And Search's Categories and Tags, which show Offline.
    keys.library.discover.pathKey(),
  ]) {
    queryClient.setQueryDefaults(pathKey, { gcTime: CACHE_MAX_AGE_MS });
  }

  // A filter chip's name, primed by what added it, kept while the Search session can show it.
  queryClient.setQueryDefaults(keys.ingredients.names.pathKey(), { gcTime: Infinity });

  // Settings are read as they are now: a reveal after a save must show the saved key.
  queryClient.setQueryDefaults(keys.admin.pathKey(), { staleTime: 0, gcTime: 0 });

  return queryClient;
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
  /**
   * Named values an owner's screens keep on the device (Recent Searches), cleared with the owner's
   * read copy. Only the open owner's data is read or written; a call for any other does nothing.
   */
  ownerData: {
    /** The owner whose data is open: null with none applied and while its data is being cleared. */
    owner(): string | null;
    /** While closed, the owner it reopens for: another after a switch, the same after a wipe, null
     * after a sign-out. While open, the open owner. */
    next(): string | null;
    read<T>(owner: string, name: string): Promise<T | undefined>;
    write(owner: string, name: string, value: unknown): Promise<void>;
    /** Told when the open owner changes, as a switch, sign-out or wipe starts and ends. */
    subscribe(listener: () => void): () => void;
  };
  /** Observe the one applied-owner value. */
  subscribe(listener: () => void): () => void;
  /** Save a throttled pending change now, as the app leaves the foreground. */
  flush(): Promise<void>;
}

interface CacheManagerOptions {
  storage: OfflineStorage;
  /** A restored cache from a different app version is dropped wholesale, never migrated. */
  buster: string | undefined;
  refetchOnMount?: RefetchOnMount;
  /** Told whenever the in-memory client is cleared (an account switch or a reset). */
  onClear?: () => void;
}

export function createCacheManager({
  storage,
  buster,
  refetchOnMount,
  onClear,
}: CacheManagerOptions): CacheManager {
  const { keyval, lastOwner } = storage;
  let bootOwner = lastOwner.get();
  const queryStore = createQueryStore(keyval);
  const queryClient = createOfflineQueryClient({ refetchOnMount });

  let appliedOwner: string | null = null;
  let unsubscribe: (() => void) | null = null;
  let flushPending: () => Promise<void> = async () => undefined;
  let inFlight: Promise<void> = Promise.resolve();
  const appliedListeners = new Set<() => void>();
  let dataOwner: string | null = null;
  let dataNext: string | null = null;
  const dataListeners = new Set<() => void>();
  // Bumped whenever the open owner changes; a write made under an older one is stale.
  let dataGeneration = 0;
  // Per owner-data key: its chain of writes, and the newest value that chain has yet to write.
  const writeChains = new Map<string, Promise<void>>();
  const pendingWrites = new Map<string, { value: unknown; generation: number }>();
  // Counts the identity requests that closed owner data; only the newest one reopens it.
  let identityRequest = 0;

  function openOwnerData(owner: string | null, next = owner): void {
    dataNext = next;
    if (owner === dataOwner) return;

    dataOwner = owner;
    dataGeneration++;
    pendingWrites.clear();
    dataListeners.forEach((listener) => listener());
  }

  function writeOwnerData(key: string, value: unknown): Promise<void> {
    pendingWrites.set(key, { value, generation: dataGeneration });

    const step = (writeChains.get(key) ?? Promise.resolve()).then(async () => {
      const next = pendingWrites.get(key);

      if (!next) return;
      pendingWrites.delete(key);
      await keyval.set(key, next.value);
      // Landed after its owner's data closed, so the clear may have missed it.
      if (next.generation !== dataGeneration) await keyval.del(key);
    });
    const chain = step.catch(() => undefined);

    writeChains.set(key, chain);
    void chain.then(() => {
      if (writeChains.get(key) === chain) writeChains.delete(key);
    });

    return step;
  }

  /** `held`: reads already in the client, which no event would save. */
  function subscribeToPersistence(owner: string, held: string[] = []): void {
    unsubscribe?.();

    // The reads changed since the last save, by query hash; a save writes or deletes only those.
    const dirty = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;
    const markDirty = (hash: string) => {
      dirty.add(hash);
      timer ??= setTimeout(() => whenIdle(() => void save()), PERSIST_THROTTLE_MS);
    };
    const save = async () => {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      if (stopped || dirty.size === 0) return;

      const hashes = new Set(dirty);

      dirty.clear();
      // The Outbox is the durable write queue (ADR-0009), so mutations are never persisted.
      const { queries } = dehydrate(queryClient, {
        shouldDehydrateQuery: (query) => hashes.has(query.queryHash) && shouldDehydrateQuery(query),
        shouldDehydrateMutation: () => false,
      });
      const written = new Set(queries.map((query) => query.queryHash));

      await Promise.all([
        ...queries.map((query) => queryStore.write(owner, query, buster)),
        ...[...hashes]
          .filter((hash) => !written.has(hash))
          .map((hash) => queryStore.remove(owner, hash)),
      ]);
    };
    // A trailing throttle, then the next idle moment: a burst of changes saves once, never
    // during a scroll or a tap. Only new data, a read hydrated with data, or a dropped one changes the copy.
    const stopListening = queryClient.getQueryCache().subscribe((event) => {
      const changed =
        event.type === "removed" ||
        (event.type === "added" && event.query.state.data !== undefined) ||
        (event.type === "updated" &&
          (event.action.type === "success" || event.action.type === "setState"));

      if (changed) markDirty(event.query.queryHash);
    });

    held.forEach(markDirty);
    // Leaving the foreground also marks the copy as in use, so a week Offline keeps it.
    flushPending = async () => {
      await save();
      if (!stopped) await queryStore.touch(owner);
    };
    unsubscribe = () => {
      // A save still pending after a clear would write the purged reads back.
      stopped = true;
      if (timer !== null) clearTimeout(timer);
      timer = null;
      stopListening();
    };
  }

  function clearClient(): void {
    unsubscribe?.();
    unsubscribe = null;
    openOwnerData(null);
    queryClient.clear();
    onClear?.();
  }

  function notifyOwnerApplied(): void {
    for (const listener of appliedListeners) {
      listener();
    }
  }

  async function clearPersonalCaches(): Promise<void> {
    await storage.clearPersonalCaches?.();
  }

  async function clearOwnerData(owner: string): Promise<void> {
    const prefix = ownerDataPrefix(owner);

    const landing = [...writeChains]
      .filter(([key]) => key.startsWith(prefix))
      .map(([, chain]) => chain);

    // Bounded, so a write that never settles cannot hold a session open; a later one undoes itself.
    if (landing.length > 0) {
      let timer: ReturnType<typeof setTimeout> | undefined;

      await Promise.race([
        Promise.all(landing),
        new Promise((resolve) => {
          timer = setTimeout(resolve, OWNER_WRITE_WAIT_MS);
        }),
      ]);
      clearTimeout(timer);
    }
    const keys = (await keyval.keys()).filter((key) => key.startsWith(prefix));

    await Promise.all(keys.map((key) => keyval.del(key)));
  }

  async function clearOwnerReadArtifacts(owner: string): Promise<void> {
    // A failure in one store must not prevent the other cleanup attempts
    // or strand the manager between lifecycle states.
    await Promise.allSettled([
      queryStore.clear(owner),
      clearLastWarmedAt(owner, keyval),
      clearOwnerData(owner),
      clearPersonalCaches(),
    ]);
  }

  function writeLastOwner(owner: string | null): void {
    try {
      lastOwner.set(owner);
    } catch {
      // Storage failure: identity degrades to in-memory only.
    }
  }

  async function restoreForOwner(owner: string): Promise<void> {
    // On a first adoption the client holds reads made before the owner was known.
    const held = queryClient
      .getQueryCache()
      .getAll()
      .map((query) => query.queryHash);
    const queries = await queryStore.restore(owner, { buster, maxAge: CACHE_MAX_AGE_MS });

    // Dehydration drops per-query gcTime, so without a hydrate-time floor every restored read,
    // warmed ones included, reverts to the 10-minute default, is GC'd shortly after boot and is
    // deleted from disk: a warmed recipe would not survive a second Offline reload (ADR-0008).
    hydrate(
      queryClient,
      { queries, mutations: [] },
      { defaultOptions: { queries: { gcTime: CACHE_MAX_AGE_MS } } }
    );

    subscribeToPersistence(owner, held);

    appliedOwner = owner;
    bootOwner = owner;
    writeLastOwner(owner);
    notifyOwnerApplied();
  }

  function targetOwner({
    sessionUserId,
    isOffline,
  }: {
    sessionUserId: string | null;
    isOffline: boolean;
  }): string | null {
    return sessionUserId ?? (isOffline ? (appliedOwner ?? bootOwner) : null);
  }

  /** Queues `task`; a request that changes owner closes owner data now, on its way to `next`. */
  function enqueue(
    task: () => Promise<void>,
    closesOwnerData: boolean,
    next: string | null
  ): Promise<void> {
    if (closesOwnerData) {
      identityRequest++;
      openOwnerData(null, next);
    }

    const request = identityRequest;

    inFlight = inFlight
      .then(task)
      .catch(() => undefined)
      .then(() => {
        if (request === identityRequest) openOwnerData(appliedOwner);
      });

    return inFlight;
  }

  async function applyIdentity(inputs: {
    sessionUserId: string | null;
    isOffline: boolean;
  }): Promise<void> {
    const knownOwner = appliedOwner ?? bootOwner;
    const nextOwner = targetOwner(inputs);

    if (!nextOwner || appliedOwner === nextOwner) {
      return;
    }

    // Account switch: purge the departed user's reads and personalized images
    // before adopting the new one, then start the new owner from a clean
    // in-memory client. The departed user's Outbox is deliberately untouched —
    // it stays dormant under its owner (ADR-0009).
    if (knownOwner && knownOwner !== nextOwner) {
      clearClient();

      await Promise.all([
        clearOwnerReadArtifacts(knownOwner),
        purgeForeignReadArtifacts(keyval, nextOwner),
      ]);
    }

    // A first-ever adoption keeps what is already in the client. Everything in
    // it was read moments ago under this very session, so there is nothing
    // foreign to purge — and clearing it strands every read still in flight:
    // the observer is left watching a query that no longer exists, holding its
    // loading state until some unrelated re-render happens to rebuild it. That
    // is a first paint that never settles.

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
      const nextOwner = targetOwner(inputs);

      return enqueue(
        () => applyIdentity(inputs),
        nextOwner !== null && nextOwner !== dataOwner,
        nextOwner
      );
    },

    resetOfflineCopy(cause) {
      return enqueue(
        async () => {
          const owner = appliedOwner ?? bootOwner;

          clearClient();

          if (owner) {
            await clearOwnerReadArtifacts(owner);
          } else {
            await Promise.allSettled([clearPersonalCaches()]);
          }

          if (cause === "sign-out") {
            appliedOwner = null;
            bootOwner = null;
            writeLastOwner(null);
            notifyOwnerApplied();

            return;
          }

          if (owner) subscribeToPersistence(owner);
        },
        true,
        cause === "sign-out" ? null : (appliedOwner ?? bootOwner)
      );
    },

    ownerData: {
      owner: () => dataOwner,
      next: () => dataNext,
      read: async <T>(owner: string, name: string) =>
        owner === dataOwner ? keyval.get<T>(ownerDataKey(owner, name)) : undefined,
      write: async (owner, name, value) => {
        if (owner === dataOwner) await writeOwnerData(ownerDataKey(owner, name), value);
      },
      subscribe(listener) {
        dataListeners.add(listener);

        return () => {
          dataListeners.delete(listener);
        };
      },
    },

    flush: () => flushPending(),

    subscribe(listener) {
      appliedListeners.add(listener);

      return () => {
        appliedListeners.delete(listener);
      };
    },
  };
}
