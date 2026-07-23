import type { OfflineIdb } from "@/lib/offline/idb";
import type { PersistedClient } from "@tanstack/query-persist-client-core";
import { IMAGE_CACHE_NAME } from "@/lib/offline/cache-names";
import { createOfflineIdb, KEYVAL_STORE, OUTBOX_STORE } from "@/lib/offline/idb";
import { queryCacheKey } from "@/lib/query-cache/cache-identity";
import { readLastWarmedAt, writeLastWarmedAt } from "@/lib/query-cache/last-warmed";
import {
  CACHE_BUSTER,
  CACHE_MAX_AGE_MS,
  createCacheManager,
} from "@/lib/query-cache/persisted-query-client";
import { dehydrate, QueryClient } from "@tanstack/react-query";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
    expect(deletedCaches).toEqual([IMAGE_CACHE_NAME]);
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
