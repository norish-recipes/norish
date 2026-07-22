import type { OfflineIdb } from "@/lib/offline/idb";
import type { PersistedClient } from "@tanstack/query-persist-client-core";
import { createOfflineIdb, KEYVAL_STORE } from "@/lib/offline/idb";
import { queryCacheKey } from "@/lib/query-cache/cache-identity";
import { createIdbPersister } from "@/lib/query-cache/idb-persister";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";

function fakeClient(marker: string): PersistedClient {
  return {
    timestamp: 0,
    buster: "test",
    clientState: { mutations: [], queries: [{ marker } as never] },
  } as PersistedClient;
}

describe("createIdbPersister", () => {
  let idb: OfflineIdb;

  beforeEach(() => {
    idb = createOfflineIdb(new IDBFactory());
  });

  it("persists and restores a client under the owner's cache key", async () => {
    const persister = createIdbPersister(idb, "owner-a");

    await persister.persistClient(fakeClient("a"));

    expect(await persister.restoreClient()).toEqual(fakeClient("a"));
    expect(await idb.get(KEYVAL_STORE, queryCacheKey("owner-a"))).toEqual(fakeClient("a"));
  });

  it("returns undefined when nothing is stored for the owner", async () => {
    const persister = createIdbPersister(idb, "empty");

    expect(await persister.restoreClient()).toBeUndefined();
  });

  it("re-keys to another owner without touching the first owner's blob", async () => {
    const persister = createIdbPersister(idb, "owner-a");

    await persister.persistClient(fakeClient("a"));
    persister.setOwner("owner-b");

    expect(persister.currentOwner()).toBe("owner-b");
    // owner-b has nothing yet...
    expect(await persister.restoreClient()).toBeUndefined();

    await persister.persistClient(fakeClient("b"));

    // ...and owner-a's blob is still intact.
    expect(await idb.get(KEYVAL_STORE, queryCacheKey("owner-a"))).toEqual(fakeClient("a"));
    expect(await idb.get(KEYVAL_STORE, queryCacheKey("owner-b"))).toEqual(fakeClient("b"));
  });

  it("removes the current owner's blob", async () => {
    const persister = createIdbPersister(idb, "owner-a");

    await persister.persistClient(fakeClient("a"));
    await persister.removeClient();

    expect(await persister.restoreClient()).toBeUndefined();
  });
});
