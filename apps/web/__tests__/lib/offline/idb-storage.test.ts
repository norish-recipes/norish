import { File } from "node:buffer";
import { CACHE_OWNER_STORAGE_KEY, createIdbStorage } from "@/lib/offline/idb-storage";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";

import type { NewOutboxEntry } from "@norish/shared-react/offline";
import { createOutboxStore } from "@norish/shared-react/offline";
import { describeOfflineStorageContract } from "@norish/shared-react/offline/testing";

// fake-indexeddb clones with Node's structuredClone, which keeps Node's File but not jsdom's.
describeOfflineStorageContract("IndexedDB (web)", {
  create: () => createIdbStorage(new IDBFactory()),
  makeBlob: (text, name, type) => new File([text], name, { type }),
  readBlob: async (value) => {
    const file = value as File;

    return { text: await file.text(), name: file.name, type: file.type };
  },
});

function entry(overrides: Partial<NewOutboxEntry> = {}): NewOutboxEntry {
  return {
    id: "e",
    ownerId: "u1",
    path: "groceries.create",
    input: { id: "g1" },
    entityId: "g1",
    operationId: null,
    headers: {},
    ...overrides,
  };
}

describe("IndexedDB storage adapter", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("rejects the enqueue when the IndexedDB transaction fails (quota, clone)", async () => {
    // The same observable behaviour as a quota error: the promise must reject so the
    // caller can present a real failure instead of a false Queued (ADR-0009).
    const store = createOutboxStore(createIdbStorage(new IDBFactory()).outbox);

    await expect(
      store.enqueue(entry({ input: { fn: () => "not clonable" } }))
    ).rejects.toBeTruthy();
    expect(await store.size()).toBe(0);
  });

  it("keeps the last owner under the key earlier releases wrote", () => {
    const storage = createIdbStorage(new IDBFactory());

    window.localStorage.setItem(CACHE_OWNER_STORAGE_KEY, "u0");
    expect(CACHE_OWNER_STORAGE_KEY).toBe("norish.offline.cache-owner");
    expect(storage.lastOwner.get()).toBe("u0");

    storage.lastOwner.set("u1");
    expect(window.localStorage.getItem(CACHE_OWNER_STORAGE_KEY)).toBe("u1");

    storage.lastOwner.set(null);
    expect(window.localStorage.getItem(CACHE_OWNER_STORAGE_KEY)).toBeNull();
  });

  it("tells another tab's store that the queue changed", async () => {
    const factory = new IDBFactory();
    const thisTab = createOutboxStore(createIdbStorage(factory).outbox);
    const otherTab = createOutboxStore(createIdbStorage(factory).outbox);
    let heard = 0;

    otherTab.subscribe(() => {
      heard += 1;
    });
    await thisTab.enqueue(entry());

    await expect.poll(() => heard).toBeGreaterThan(0);
    expect(await otherTab.size("u1")).toBe(1);
  });
});
