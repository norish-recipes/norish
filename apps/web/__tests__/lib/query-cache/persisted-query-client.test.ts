import type { OfflineIdb } from "@/lib/offline/idb";
import type { PersistedClient } from "@tanstack/query-persist-client-core";
import { IMAGE_CACHE_NAME, PAGE_CACHE_NAMES } from "@/lib/offline/cache-names";
import { createOfflineIdb, KEYVAL_STORE, OUTBOX_STORE } from "@/lib/offline/idb";
import { queryCacheKey } from "@/lib/query-cache/cache-identity";
import { readLastWarmedAt, writeLastWarmedAt } from "@/lib/query-cache/last-warmed";
import {
  CACHE_BUSTER,
  CACHE_MAX_AGE_MS,
  createCacheManager,
  markServerCopies,
} from "@/lib/query-cache/persisted-query-client";
import { PAGES_CACHE_NAME } from "@serwist/turbopack/worker";
import { dehydrate, hydrate, QueryClient, QueryObserver } from "@tanstack/react-query";
import { createTRPCClient } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AppRouter } from "@norish/trpc/client";

/** Build a valid persisted cache blob holding a single successful query. */
function seedClient(key: unknown[], value: unknown): PersistedClient {
  const source = new QueryClient();

  source.setQueryData(key, value);

  return { timestamp: Date.now(), buster: CACHE_BUSTER, clientState: dehydrate(source) };
}

async function seedOwnerCache(
  idb: OfflineIdb,
  owner: string,
  key: unknown[],
  value: unknown
): Promise<void> {
  await idb.set(KEYVAL_STORE, queryCacheKey(owner), seedClient(key, value));
}

describe("createCacheManager", () => {
  let idb: OfflineIdb;

  beforeEach(() => {
    window.localStorage.clear();
    idb = createOfflineIdb(new IDBFactory());
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does nothing while the online session is still unresolved", async () => {
    const manager = createCacheManager(idb);

    await manager.reconcileIdentity({ sessionUserId: null, isOffline: false });

    expect(manager.owner()).toBeNull();
    expect(manager.queryClient.getQueryData(["greeting"])).toBeUndefined();
  });

  it("restores the confirmed user's persisted cache", async () => {
    await seedOwnerCache(idb, "u1", ["greeting"], "hello");
    window.localStorage.setItem("norish.offline.cache-owner", "u1");

    const manager = createCacheManager(idb);

    await manager.reconcileIdentity({ sessionUserId: "u1", isOffline: false });

    expect(manager.owner()).toBe("u1");
    expect(manager.queryClient.getQueryData(["greeting"])).toBe("hello");
  });

  it("restores from the last-known owner while Offline, without a session", async () => {
    await seedOwnerCache(idb, "u1", ["greeting"], "cached-while-offline");
    window.localStorage.setItem("norish.offline.cache-owner", "u1");

    const manager = createCacheManager(idb);

    await manager.reconcileIdentity({ sessionUserId: null, isOffline: true });

    expect(manager.owner()).toBe("u1");
    expect(manager.queryClient.getQueryData(["greeting"])).toBe("cached-while-offline");
  });

  it("purges the departed user's cache and never surfaces it on an account switch", async () => {
    await seedOwnerCache(idb, "u1", ["greeting"], "u1-secret");
    await writeLastWarmedAt("u1", 123, idb);
    window.localStorage.setItem("norish.offline.cache-owner", "u1");

    const manager = createCacheManager(idb);

    // A different user signs in on the same browser.
    await manager.reconcileIdentity({ sessionUserId: "u2", isOffline: false });

    expect(manager.owner()).toBe("u2");
    // u1's data is gone from both the live client and IndexedDB.
    expect(manager.queryClient.getQueryData(["greeting"])).toBeUndefined();
    expect(await idb.get(KEYVAL_STORE, queryCacheKey("u1"))).toBeUndefined();
    expect(await readLastWarmedAt("u1", idb)).toBeNull();
    // The new owner is recorded as the cache owner.
    expect(window.localStorage.getItem("norish.offline.cache-owner")).toBe("u2");
  });

  it("adopts a first owner without a purge and starts persisting under their key", async () => {
    const manager = createCacheManager(idb);

    await manager.reconcileIdentity({ sessionUserId: "u1", isOffline: false });
    manager.queryClient.setQueryData(["k"], "v");

    // Give the persist subscription a tick to flush.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(manager.owner()).toBe("u1");
    expect(await idb.get(KEYVAL_STORE, queryCacheKey("u1"))).toBeDefined();
  });

  it("restores last successful data after background refetches fail", async () => {
    const manager = createCacheManager(idb);
    const cachedReads = [
      {
        key: [["groceries", "list"], { type: "query" }],
        value: { items: [{ id: "g1", name: "Oat milk" }] },
      },
      {
        key: [
          ["calendar", "listItems"],
          { input: { startISO: "2026-07-27", endISO: "2026-08-03" }, type: "query" },
        ],
        value: [{ id: "plan-1", recipeId: "r1" }],
      },
      {
        key: [["recipes", "list"], { input: {}, type: "infinite" }],
        value: { pages: [{ items: [{ id: "r1", name: "Soup" }] }], pageParams: [null] },
      },
      {
        key: [["recipes", "get"], { input: { id: "r1" }, type: "query" }],
        value: { id: "r1", name: "Soup" },
      },
      {
        key: [["user", "get"], { type: "query" }],
        value: { id: "u1", name: "Offline User" },
      },
    ] as const;

    await manager.reconcileIdentity({ sessionUserId: "u1", isOffline: false });

    for (const { key, value } of cachedReads) {
      manager.queryClient.setQueryData(key, value);
      await expect(
        manager.queryClient.fetchQuery({
          queryKey: key,
          queryFn: () => Promise.reject(new Error("backend unavailable")),
          retry: false,
          staleTime: 0,
        })
      ).rejects.toThrow("backend unavailable");
    }

    await new Promise((resolve) => setTimeout(resolve, 0));

    const restored = createCacheManager(idb);

    await restored.reconcileIdentity({ sessionUserId: null, isOffline: true });

    for (const { key, value } of cachedReads) {
      expect(restored.queryClient.getQueryData(key)).toEqual(value);
    }
  });

  it("does not restore a query whose initial request failed without data", async () => {
    const manager = createCacheManager(idb);
    const failedKey = [["groceries", "list"], { type: "query" }] as const;

    await manager.reconcileIdentity({ sessionUserId: "u1", isOffline: false });
    await expect(
      manager.queryClient.fetchQuery({
        queryKey: failedKey,
        queryFn: () => Promise.reject(new Error("backend unavailable")),
        retry: false,
      })
    ).rejects.toThrow("backend unavailable");
    await new Promise((resolve) => setTimeout(resolve, 0));

    const restored = createCacheManager(idb);

    await restored.reconcileIdentity({ sessionUserId: null, isOffline: true });

    expect(restored.queryClient.getQueryState(failedKey)).toBeUndefined();
  });

  it("restores entries at the cache's own maxAge as their gcTime (ADR-0008 durability)", async () => {
    await seedOwnerCache(idb, "u1", ["recipes", "get", "r1"], { id: "r1" });
    window.localStorage.setItem("norish.offline.cache-owner", "u1");

    const manager = createCacheManager(idb);

    await manager.reconcileIdentity({ sessionUserId: "u1", isOffline: false });

    // Dehydration drops per-query gcTime, so without the hydrate-time floor this
    // would be the 10-minute default — and a warmed entry would be GC'd and fall
    // out of the next persist, not surviving a second Offline reload.
    const query = manager.queryClient.getQueryCache().find({ queryKey: ["recipes", "get", "r1"] });

    expect(query?.gcTime).toBe(CACHE_MAX_AGE_MS);
  });

  it("holds a recipe and a cookbook the reader opened past the default gcTime (ADR-0008)", async () => {
    vi.useFakeTimers();

    const { queryClient } = createCacheManager(idb);
    // The app's own keys, so this proves the held paths match what tRPC builds.
    const trpc = createTRPCOptionsProxy<AppRouter>({
      client: createTRPCClient<AppRouter>({ links: [] }),
      queryClient,
    });
    const opened = [
      trpc.recipes.get.queryKey({ id: "r1" }),
      trpc.cookbooks.get.queryKey({ id: "c1" }),
    ];
    const elsewhere = trpc.groceries.list.queryKey();

    for (const queryKey of [...opened, elsewhere]) {
      // The page reads it while it is open, then the reader leaves.
      const page = new QueryObserver(queryClient, { queryKey, queryFn: async () => ({}) });
      const leave = page.subscribe(() => {});

      await vi.waitFor(() => expect(page.getCurrentResult().isSuccess).toBe(true));
      leave();
    }

    await vi.advanceTimersByTimeAsync(10 * 60 * 1000 + 1);

    for (const queryKey of opened) {
      expect(queryClient.getQueryData(queryKey)).toBeDefined();
    }

    // Any other read goes at the default, so the clock really did pass it.
    expect(queryClient.getQueryData(elsewhere)).toBeUndefined();
  });

  it("opens the server's copy as it is until it changes, and refetches any other copy", async () => {
    const { queryClient } = createCacheManager(idb);
    const trpc = createTRPCOptionsProxy<AppRouter>({
      client: createTRPCClient<AppRouter>({ links: [] }),
      queryClient,
    });
    const fetchesOnOpen = async (queryKey: readonly unknown[]) => {
      const queryFn = vi.fn(async () => ({ fetched: true }));
      const leave = new QueryObserver(queryClient, { queryKey, queryFn }).subscribe(() => {});

      await new Promise((resolve) => setTimeout(resolve, 0));
      leave();

      return queryFn.mock.calls.length;
    };
    // The app's own keys, untagged so the test can seed any data.
    const seeded = [...trpc.recipes.get.queryKey({ id: "r1" })];
    const restored = [...trpc.recipes.get.queryKey({ id: "r2" })];
    const kept = [...trpc.recipes.get.queryKey({ id: "r3" })];

    // What QuerySeed hands over: the server's copy of r1, and of r3 in a document the
    // service worker kept from ten minutes ago.
    const server = new QueryClient();

    server.setQueryData(seeded, { id: "r1" });
    server.setQueryData(kept, { id: "r3" }, { updatedAt: Date.now() - 10 * 60 * 1000 });
    const state = dehydrate(server);

    markServerCopies(state);
    hydrate(queryClient, state);
    // r2 is as fresh, but from the Offline Cache: it may predate a change made elsewhere.
    queryClient.setQueryData(restored, { id: "r2" });

    expect(await fetchesOnOpen(seeded)).toBe(0);
    expect(await fetchesOnOpen(restored)).toBe(1);
    expect(await fetchesOnOpen(kept)).toBe(1);

    // Once the server's copy has changed, it refetches on mount like any other.
    queryClient.setQueryData(seeded, { id: "r1", edited: true });

    expect(await fetchesOnOpen(seeded)).toBe(1);
  });

  it("resets every personalized read artifact while preserving the Outbox and app shell", async () => {
    const deletedCaches: string[] = [];

    vi.stubGlobal("caches", {
      delete: vi.fn(async (name: string) => {
        deletedCaches.push(name);

        return true;
      }),
    });

    await seedOwnerCache(idb, "u1", ["persisted"], "read");
    await writeLastWarmedAt("u1", 123, idb);
    await idb.transaction(OUTBOX_STORE, "readwrite", (store) =>
      store.add({ ownerId: "u1", path: "groceries.create" })
    );
    window.localStorage.setItem("norish.offline.cache-owner", "u1");

    const manager = createCacheManager(idb);

    await manager.reconcileIdentity({ sessionUserId: "u1", isOffline: false });
    manager.queryClient.setQueryData(["memory"], "read");
    await manager.resetOfflineCopy("manual");

    expect(manager.queryClient.getQueryData(["memory"])).toBeUndefined();
    expect(await idb.get(KEYVAL_STORE, queryCacheKey("u1"))).toBeUndefined();
    expect(await readLastWarmedAt("u1", idb)).toBeNull();
    // A recipe page's document carries its recipe, so the service worker's page caches go too.
    expect(PAGE_CACHE_NAMES).toEqual(Object.values(PAGES_CACHE_NAME));
    expect(deletedCaches).toEqual([IMAGE_CACHE_NAME, ...PAGE_CACHE_NAMES]);
    expect(await idb.transaction(OUTBOX_STORE, "readonly", (store) => store.count())).toBe(1);

    manager.queryClient.setQueryData(["rewarmed"], "read");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(manager.owner()).toBe("u1");
    expect(await idb.get(KEYVAL_STORE, queryCacheKey("u1"))).toBeDefined();

    vi.unstubAllGlobals();
  });

  it("forgets the cache owner after a sign-out reset", async () => {
    window.localStorage.setItem("norish.offline.cache-owner", "u1");

    const manager = createCacheManager(idb);

    await manager.reconcileIdentity({ sessionUserId: "u1", isOffline: false });
    await manager.resetOfflineCopy("sign-out");

    expect(manager.owner()).toBeNull();
    expect(window.localStorage.getItem("norish.offline.cache-owner")).toBeNull();
  });

  it("finalizes sign-out identity even when an artifact cannot be deleted", async () => {
    window.localStorage.setItem("norish.offline.cache-owner", "u1");

    const manager = createCacheManager(idb);

    await manager.reconcileIdentity({ sessionUserId: "u1", isOffline: false });
    vi.spyOn(idb, "del").mockRejectedValueOnce(new Error("storage unavailable"));
    await manager.resetOfflineCopy("sign-out");

    expect(manager.owner()).toBeNull();
    expect(window.localStorage.getItem("norish.offline.cache-owner")).toBeNull();
  });

  it("resumes manual-reset persistence when an artifact cannot be deleted", async () => {
    window.localStorage.setItem("norish.offline.cache-owner", "u1");

    const manager = createCacheManager(idb);

    await manager.reconcileIdentity({ sessionUserId: "u1", isOffline: false });
    vi.spyOn(idb, "del").mockRejectedValueOnce(new Error("storage unavailable"));
    await manager.resetOfflineCopy("manual");

    manager.queryClient.setQueryData(["after-reset"], "fresh");
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(manager.owner()).toBe("u1");
    expect(await idb.get(KEYVAL_STORE, queryCacheKey("u1"))).toBeDefined();
  });

  it("publishes the applied owner as its only identity observable", async () => {
    const manager = createCacheManager(idb);
    const owners: Array<string | null> = [];
    const unsubscribe = manager.subscribe(() => owners.push(manager.owner()));

    await manager.reconcileIdentity({ sessionUserId: "u1", isOffline: false });
    await manager.reconcileIdentity({ sessionUserId: "u2", isOffline: false });
    unsubscribe();
    await manager.reconcileIdentity({ sessionUserId: "u3", isOffline: false });

    expect(owners).toEqual(["u1", "u2"]);
  });
});
