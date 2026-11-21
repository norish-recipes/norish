import { beforeEach, describe, expect, it } from "vitest";

import type { OfflineStorage } from "./storage";
import { ownerFromCacheKey, purgeForeignReadArtifacts, queryCacheKey } from "./cache-identity";
import { readLastWarmedAt, writeLastWarmedAt } from "./last-warmed";
import { createMemoryStorage } from "./testing/memory-storage";

const HASH = '["greeting"]';

describe("cache key helpers", () => {
  it("round-trips an owner through the cache key", () => {
    expect(queryCacheKey("abc", HASH)).toBe(`query-cache:abc:${HASH}`);
    expect(ownerFromCacheKey(queryCacheKey("abc", HASH))).toBe("abc");
  });

  it("rejects keys that are not owned query caches", () => {
    expect(ownerFromCacheKey("query-cache:")).toBeNull();
    expect(ownerFromCacheKey("outbox-meta")).toBeNull();
    expect(ownerFromCacheKey(42)).toBeNull();
  });
});

describe("purgeForeignReadArtifacts", () => {
  let idb: OfflineStorage["keyval"];

  beforeEach(() => {
    idb = createMemoryStorage().keyval;
  });

  it("removes every foreign owner's cache and keeps the current owner's", async () => {
    await idb.set(queryCacheKey("u1", HASH), { v: 1 });
    await idb.set(queryCacheKey("u2", HASH), { v: 2 });
    await idb.set(queryCacheKey("u3", HASH), { v: 3 });
    await writeLastWarmedAt("u1", 1, idb);
    await writeLastWarmedAt("u2", 2, idb);
    await writeLastWarmedAt("u3", 3, idb);

    await purgeForeignReadArtifacts(idb, "u2");

    expect(await idb.get(queryCacheKey("u1", HASH))).toBeUndefined();
    expect(await idb.get(queryCacheKey("u2", HASH))).toEqual({ v: 2 });
    expect(await idb.get(queryCacheKey("u3", HASH))).toBeUndefined();
    expect(await readLastWarmedAt("u1", idb)).toBeNull();
    expect(await readLastWarmedAt("u2", idb)).toBe(2);
    expect(await readLastWarmedAt("u3", idb)).toBeNull();
  });

  it("leaves non-cache keys untouched", async () => {
    await idb.set("unrelated-key", { keep: true });
    await idb.set(queryCacheKey("u1", HASH), { v: 1 });

    await purgeForeignReadArtifacts(idb, "u2");

    expect(await idb.get("unrelated-key")).toEqual({ keep: true });
    expect(await idb.get(queryCacheKey("u1", HASH))).toBeUndefined();
  });
});
