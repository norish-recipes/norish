import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";

const activeCacheOwner = vi.hoisted(() => vi.fn<() => string | null>(() => "u1"));
const readBootOwner = vi.hoisted(() => vi.fn<() => string | null>(() => null));
const wipeReadCache = vi.hoisted(() => vi.fn(async () => {}));

vi.mock("@/lib/query-cache", () => ({ activeCacheOwner, readBootOwner, wipeReadCache }));

import type { QueryClient } from "@tanstack/react-query";

import { createOfflineIdb } from "@/lib/offline/idb";
import { IMAGE_CACHE_NAME } from "@/lib/offline/cache-names";
import { clearOfflineStateForSignOut, countUnsyncedChanges } from "@/lib/offline/sign-out";
import { createOutboxStore, type OutboxStore } from "@/lib/outbox/outbox-store";
import type { NewOutboxEntry } from "@/lib/outbox/outbox-types";

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

describe("sign-out offline state (ADR-0009)", () => {
  let store: OutboxStore;
  const queryClient = {} as QueryClient;
  const deletedCaches: string[] = [];

  beforeEach(() => {
    store = createOutboxStore(createOfflineIdb(new IDBFactory()));
    activeCacheOwner.mockReturnValue("u1");
    readBootOwner.mockReturnValue(null);
    wipeReadCache.mockClear();
    deletedCaches.length = 0;
    vi.stubGlobal("caches", {
      delete: vi.fn(async (name: string) => {
        deletedCaches.push(name);

        return true;
      }),
    });

    return () => vi.unstubAllGlobals();
  });

  it("counts the active owner's queued changes, parked included", async () => {
    await store.enqueue(entry());
    const parked = await store.enqueue(entry({ id: "p" }));

    await store.park(parked.seq, "deterministic");
    await store.enqueue(entry({ ownerId: "someone-else" }));

    await expect(countUnsyncedChanges(store)).resolves.toBe(2);
  });

  it("counts zero when no owner is resolvable", async () => {
    activeCacheOwner.mockReturnValue(null);

    await store.enqueue(entry());

    await expect(countUnsyncedChanges(store)).resolves.toBe(0);
  });

  it("clears reads and images but keeps the queue without discard confirmation", async () => {
    await store.enqueue(entry());

    await clearOfflineStateForSignOut({ queryClient, discardQueue: false, store });

    expect(await store.size("u1")).toBe(1);
    expect(wipeReadCache).toHaveBeenCalledWith(queryClient, { ownerId: "u1" });
    expect(deletedCaches).toEqual([IMAGE_CACHE_NAME]);
  });

  it("discards only the active owner's queue after confirmation", async () => {
    await store.enqueue(entry());
    await store.enqueue(entry({ id: "b" }));
    await store.enqueue(entry({ id: "dormant", ownerId: "someone-else" }));

    await clearOfflineStateForSignOut({ queryClient, discardQueue: true, store });

    expect(await store.size("u1")).toBe(0);
    // Another owner's dormant queue is never touched by this user's sign-out.
    expect(await store.size("someone-else")).toBe(1);
    expect(wipeReadCache).toHaveBeenCalledTimes(1);
    expect(deletedCaches).toEqual([IMAGE_CACHE_NAME]);
  });
});
