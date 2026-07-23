import type { OutboxStore } from "@/lib/outbox/outbox-store";
import type { NewOutboxEntry } from "@/lib/outbox/outbox-types";
import { createOfflineIdb } from "@/lib/offline/idb";
import { clearOfflineStateForSignOut, countUnsyncedChanges } from "@/lib/offline/sign-out";
import { createOutboxStore } from "@/lib/outbox/outbox-store";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";

const owner = vi.hoisted(() => vi.fn<() => string | null>(() => "u1"));
const resetOfflineCopy = vi.hoisted(() => vi.fn(async () => {}));

vi.mock("@/lib/query-cache", () => ({
  cacheManager: { owner, resetOfflineCopy },
}));

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

  beforeEach(() => {
    store = createOutboxStore(createOfflineIdb(new IDBFactory()));
    owner.mockReturnValue("u1");
    resetOfflineCopy.mockClear();
  });

  it("counts the active owner's queued changes, parked included", async () => {
    await store.enqueue(entry());
    const parked = await store.enqueue(entry({ id: "p" }));

    await store.park(parked.seq, "deterministic");
    await store.enqueue(entry({ ownerId: "someone-else" }));

    await expect(countUnsyncedChanges(store)).resolves.toBe(2);
  });

  it("counts zero when no owner is resolvable", async () => {
    owner.mockReturnValue(null);

    await store.enqueue(entry());

    await expect(countUnsyncedChanges(store)).resolves.toBe(0);
  });

  it("clears reads and images but keeps the queue without discard confirmation", async () => {
    await store.enqueue(entry());

    await clearOfflineStateForSignOut({ discardQueue: false, store });

    expect(await store.size("u1")).toBe(1);
    expect(resetOfflineCopy).toHaveBeenCalledWith("sign-out");
  });

  it("discards only the active owner's queue after confirmation", async () => {
    await store.enqueue(entry());
    await store.enqueue(entry({ id: "b" }));
    await store.enqueue(entry({ id: "dormant", ownerId: "someone-else" }));

    await clearOfflineStateForSignOut({ discardQueue: true, store });

    expect(await store.size("u1")).toBe(0);
    // Another owner's dormant queue is never touched by this user's sign-out.
    expect(await store.size("someone-else")).toBe(1);
    expect(resetOfflineCopy).toHaveBeenCalledTimes(1);
  });
});
