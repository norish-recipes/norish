import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";

import { createOfflineIdb } from "@/lib/offline/idb";
import { createOutboxStore, type OutboxStore } from "@/lib/outbox/outbox-store";
import type { NewOutboxEntry } from "@/lib/outbox/outbox-types";

function entry(overrides: Partial<NewOutboxEntry> = {}): NewOutboxEntry {
  return {
    id: "e",
    ownerId: "u1",
    path: "groceries.create",
    input: { id: "g1", name: "Milk" },
    entityId: "g1",
    operationId: "op-1",
    headers: {},
    ...overrides,
  };
}

describe("outbox store", () => {
  let store: OutboxStore;

  beforeEach(() => {
    store = createOutboxStore(createOfflineIdb(new IDBFactory()));
  });

  it("appends entries with an incrementing FIFO seq and pending status", async () => {
    const a = await store.enqueue(entry({ id: "a" }));
    const b = await store.enqueue(entry({ id: "b" }));

    expect(a.seq).toBeLessThan(b.seq);
    expect(a.status).toBe("pending");
    expect(a.attempts).toBe(0);
    expect(a.createdAt).toBeTruthy();
  });

  it("returns an owner's entries in FIFO order, filtered by status", async () => {
    await store.enqueue(entry({ id: "a", ownerId: "u1" }));
    await store.enqueue(entry({ id: "b", ownerId: "u2" }));
    await store.enqueue(entry({ id: "c", ownerId: "u1" }));

    const u1 = await store.forOwner("u1");

    expect(u1.map((e) => e.id)).toEqual(["a", "c"]);

    await store.park(u1[0].seq, "deterministic");

    expect((await store.forOwner("u1", "pending")).map((e) => e.id)).toEqual(["c"]);
    expect((await store.forOwner("u1", "parked")).map((e) => e.id)).toEqual(["a"]);
  });

  it("parks a conflict into the conflicted status", async () => {
    const e = await store.enqueue(entry());

    await store.park(e.seq, "conflict");

    const [reloaded] = await store.forOwner("u1", "conflicted");

    expect(reloaded.parkedReason).toBe("conflict");
    expect(reloaded.status).toBe("conflicted");
  });

  it("updates attempts and removes entries", async () => {
    const e = await store.enqueue(entry());

    await store.update(e.seq, { attempts: 2 });
    expect((await store.forOwner("u1"))[0].attempts).toBe(2);

    await store.remove(e.seq);
    expect(await store.size()).toBe(0);
  });

  it("purges every foreign owner's entries and reports the count", async () => {
    await store.enqueue(entry({ ownerId: "u1" }));
    await store.enqueue(entry({ ownerId: "u2" }));
    await store.enqueue(entry({ ownerId: "u2" }));

    const removed = await store.purgeExcept("u1");

    expect(removed).toBe(2);
    expect(await store.size("u2")).toBe(0);
    expect(await store.size("u1")).toBe(1);
  });

  it("stores inputs by structured clone, not serialization (a Date survives as a Date)", async () => {
    // Structured clone preserves rich types (Date here; File/Blob in a real
    // browser) that JSON/superjson-string storage would flatten. `fake-indexeddb`
    // clones a Date but not a jsdom Blob, so a Date is the portable proxy.
    const when = new Date("2026-07-21T08:00:00.000Z");

    const e = await store.enqueue(entry({ id: "d", input: { when }, entityId: null }));
    const [reloaded] = (await store.forOwner("u1")).filter((x) => x.seq === e.seq);

    const restored = (reloaded.input as { when: Date }).when;

    expect(restored).toBeInstanceOf(Date);
    expect(restored.toISOString()).toBe(when.toISOString());
  });

  it("notifies subscribers when the queue changes", async () => {
    let count = 0;
    const unsubscribe = store.subscribe(() => {
      count += 1;
    });

    await store.enqueue(entry());
    expect(count).toBeGreaterThan(0);

    unsubscribe();
    const before = count;
    await store.enqueue(entry());
    expect(count).toBe(before);
  });
});
