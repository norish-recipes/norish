import type { OfflineIdb } from "@/lib/offline/idb";
import type { PersistedClient } from "@tanstack/query-persist-client-core";
import { createOfflineIdb, KEYVAL_STORE } from "@/lib/offline/idb";
import { queryCacheKey } from "@/lib/query-cache/cache-identity";
import {
  CACHE_BUSTER,
  CACHE_MAX_AGE_MS,
  createCacheManager,
} from "@/lib/query-cache/persisted-query-client";
import { dehydrate, QueryClient } from "@tanstack/react-query";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";

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

    await manager.resolveOwner({ sessionUserId: null, isOffline: false });

    expect(manager.activeOwner()).toBeNull();
    expect(manager.queryClient.getQueryData(["greeting"])).toBeUndefined();
  });

  it("restores the confirmed user's persisted cache", async () => {
    await seedOwnerCache(idb, "u1", ["greeting"], "hello");
    window.localStorage.setItem("norish.offline.cache-owner", "u1");

    const manager = createCacheManager(idb);

    await manager.resolveOwner({ sessionUserId: "u1", isOffline: false });

    expect(manager.activeOwner()).toBe("u1");
    expect(manager.queryClient.getQueryData(["greeting"])).toBe("hello");
  });

  it("restores from the last-known owner while Offline, without a session", async () => {
    await seedOwnerCache(idb, "u1", ["greeting"], "cached-while-offline");
    window.localStorage.setItem("norish.offline.cache-owner", "u1");

    const manager = createCacheManager(idb);

    await manager.resolveOwner({ sessionUserId: null, isOffline: true });

    expect(manager.activeOwner()).toBe("u1");
    expect(manager.queryClient.getQueryData(["greeting"])).toBe("cached-while-offline");
  });

  it("purges the departed user's cache and never surfaces it on an account switch", async () => {
    await seedOwnerCache(idb, "u1", ["greeting"], "u1-secret");
    window.localStorage.setItem("norish.offline.cache-owner", "u1");

    const manager = createCacheManager(idb);

    // A different user signs in on the same browser.
    await manager.resolveOwner({ sessionUserId: "u2", isOffline: false });

    expect(manager.activeOwner()).toBe("u2");
    // u1's data is gone from both the live client and IndexedDB.
    expect(manager.queryClient.getQueryData(["greeting"])).toBeUndefined();
    expect(await idb.get(KEYVAL_STORE, queryCacheKey("u1"))).toBeUndefined();
    // The new owner is recorded as the cache owner.
    expect(window.localStorage.getItem("norish.offline.cache-owner")).toBe("u2");
  });

  it("adopts a first owner without a purge and starts persisting under their key", async () => {
    const manager = createCacheManager(idb);

    await manager.resolveOwner({ sessionUserId: "u1", isOffline: false });
    manager.queryClient.setQueryData(["k"], "v");

    // Give the persist subscription a tick to flush.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(manager.activeOwner()).toBe("u1");
    expect(await idb.get(KEYVAL_STORE, queryCacheKey("u1"))).toBeDefined();
  });

  it("restores entries at the cache's own maxAge as their gcTime (ADR-0008 durability)", async () => {
    await seedOwnerCache(idb, "u1", ["recipes", "get", "r1"], { id: "r1" });
    window.localStorage.setItem("norish.offline.cache-owner", "u1");

    const manager = createCacheManager(idb);

    await manager.resolveOwner({ sessionUserId: "u1", isOffline: false });

    // Dehydration drops per-query gcTime, so without the hydrate-time floor this
    // would be the 10-minute default — and a warmed entry would be GC'd and fall
    // out of the next persist, not surviving a second Offline reload.
    const query = manager.queryClient.getQueryCache().find({ queryKey: ["recipes", "get", "r1"] });

    expect(query?.gcTime).toBe(CACHE_MAX_AGE_MS);
  });
});
