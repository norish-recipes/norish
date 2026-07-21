import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";

import { createOfflineIdb, KEYVAL_STORE, type OfflineIdb } from "@/lib/offline/idb";
import {
  CACHE_OWNER_STORAGE_KEY,
  decideCacheOwner,
  ownerFromCacheKey,
  purgeForeignCaches,
  queryCacheKey,
  readBootOwner,
  writeBootOwner,
} from "@/lib/query-cache/cache-identity";

describe("decideCacheOwner", () => {
  it("restores the same user's cache when the online session matches the boot owner", () => {
    expect(
      decideCacheOwner({ bootOwner: "u1", sessionUserId: "u1", isOffline: false })
    ).toEqual({ action: "restore", owner: "u1" });
  });

  it("switches (purging the old user) when the online session differs from the boot owner", () => {
    expect(
      decideCacheOwner({ bootOwner: "u1", sessionUserId: "u2", isOffline: false })
    ).toEqual({ action: "switch", from: "u1", to: "u2" });
  });

  it("adopts a first owner with nothing to purge when there is no boot owner", () => {
    expect(
      decideCacheOwner({ bootOwner: null, sessionUserId: "u2", isOffline: false })
    ).toEqual({ action: "switch", from: null, to: "u2" });
  });

  it("trusts the last-known owner while Offline (device possession = read access)", () => {
    expect(
      decideCacheOwner({ bootOwner: "u1", sessionUserId: null, isOffline: true })
    ).toEqual({ action: "restore", owner: "u1" });
  });

  it("waits — never guesses — when online and the session has not resolved yet", () => {
    expect(
      decideCacheOwner({ bootOwner: "u1", sessionUserId: null, isOffline: false })
    ).toEqual({ action: "wait" });
  });

  it("waits when Offline with no last-known owner (first-ever load, nothing to restore)", () => {
    expect(
      decideCacheOwner({ bootOwner: null, sessionUserId: null, isOffline: true })
    ).toEqual({ action: "wait" });
  });
});

describe("cache key helpers", () => {
  it("round-trips an owner through the cache key", () => {
    expect(queryCacheKey("abc")).toBe("query-cache:abc");
    expect(ownerFromCacheKey("query-cache:abc")).toBe("abc");
  });

  it("rejects keys that are not owned query caches", () => {
    expect(ownerFromCacheKey("query-cache:")).toBeNull();
    expect(ownerFromCacheKey("outbox-meta")).toBeNull();
    expect(ownerFromCacheKey(42)).toBeNull();
  });
});

describe("boot owner (localStorage)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("reads back what it writes", () => {
    expect(readBootOwner()).toBeNull();
    writeBootOwner("u9");
    expect(readBootOwner()).toBe("u9");
    expect(window.localStorage.getItem(CACHE_OWNER_STORAGE_KEY)).toBe("u9");
  });
});

describe("purgeForeignCaches", () => {
  let idb: OfflineIdb;

  beforeEach(() => {
    idb = createOfflineIdb(new IDBFactory());
  });

  it("removes every foreign owner's cache and keeps the current owner's", async () => {
    await idb.set(KEYVAL_STORE, queryCacheKey("u1"), { v: 1 });
    await idb.set(KEYVAL_STORE, queryCacheKey("u2"), { v: 2 });
    await idb.set(KEYVAL_STORE, queryCacheKey("u3"), { v: 3 });

    await purgeForeignCaches(idb, "u2");

    expect(await idb.get(KEYVAL_STORE, queryCacheKey("u1"))).toBeUndefined();
    expect(await idb.get(KEYVAL_STORE, queryCacheKey("u2"))).toEqual({ v: 2 });
    expect(await idb.get(KEYVAL_STORE, queryCacheKey("u3"))).toBeUndefined();
  });

  it("leaves non-cache keys untouched", async () => {
    await idb.set(KEYVAL_STORE, "unrelated-key", { keep: true });
    await idb.set(KEYVAL_STORE, queryCacheKey("u1"), { v: 1 });

    await purgeForeignCaches(idb, "u2");

    expect(await idb.get(KEYVAL_STORE, "unrelated-key")).toEqual({ keep: true });
    expect(await idb.get(KEYVAL_STORE, queryCacheKey("u1"))).toBeUndefined();
  });
});
