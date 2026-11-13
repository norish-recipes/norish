import type { PersistedClient } from "@tanstack/query-persist-client-core";
import { beforeEach, describe, expect, it } from "vitest";

import type { OfflineStorage } from "./storage";
import { queryCacheKey } from "./cache-identity";
import { createPersister } from "./persister";
import { createMemoryStorage } from "./testing/memory-storage";

function fakeClient(marker: string): PersistedClient {
  return {
    timestamp: 0,
    buster: "test",
    clientState: { mutations: [], queries: [{ marker } as never] },
  } as PersistedClient;
}

describe("createPersister", () => {
  let idb: OfflineStorage["keyval"];

  beforeEach(() => {
    idb = createMemoryStorage().keyval;
  });

  it("persists and restores a client under the owner's cache key", async () => {
    const persister = createPersister(idb, "owner-a");

    await persister.persistClient(fakeClient("a"));

    expect(await persister.restoreClient()).toEqual(fakeClient("a"));
    expect(await idb.get(queryCacheKey("owner-a"))).toEqual(fakeClient("a"));
  });

  it("returns undefined when nothing is stored for the owner", async () => {
    const persister = createPersister(idb, "empty");

    expect(await persister.restoreClient()).toBeUndefined();
  });

  it("re-keys to another owner without touching the first owner's blob", async () => {
    const persister = createPersister(idb, "owner-a");

    await persister.persistClient(fakeClient("a"));
    persister.setOwner("owner-b");

    expect(persister.currentOwner()).toBe("owner-b");
    // owner-b has nothing yet...
    expect(await persister.restoreClient()).toBeUndefined();

    await persister.persistClient(fakeClient("b"));

    // ...and owner-a's blob is still intact.
    expect(await idb.get(queryCacheKey("owner-a"))).toEqual(fakeClient("a"));
    expect(await idb.get(queryCacheKey("owner-b"))).toEqual(fakeClient("b"));
  });

  it("removes the current owner's blob", async () => {
    const persister = createPersister(idb, "owner-a");

    await persister.persistClient(fakeClient("a"));
    await persister.removeClient();

    expect(await persister.restoreClient()).toBeUndefined();
  });
});
