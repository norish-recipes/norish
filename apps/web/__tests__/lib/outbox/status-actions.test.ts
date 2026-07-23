import type { OutboxStore } from "@/lib/outbox/outbox-store";
import type { NewOutboxEntry } from "@/lib/outbox/outbox-types";
import { createOfflineIdb } from "@/lib/offline/idb";
import { createOutboxStore } from "@/lib/outbox/outbox-store";
import { discardAllEntries, requeueParkedEntries } from "@/lib/outbox/status-actions";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";

function newEntry(overrides: Partial<NewOutboxEntry> = {}): NewOutboxEntry {
  return {
    id: "e",
    ownerId: "u1",
    path: "groceries.create",
    input: {},
    entityId: null,
    operationId: null,
    headers: {},
    ...overrides,
  };
}

describe("outbox status actions", () => {
  let store: OutboxStore;

  beforeEach(() => {
    store = createOutboxStore(createOfflineIdb(new IDBFactory()));
  });

  describe("requeueParkedEntries", () => {
    it("un-parks Parked and Conflicted entries for Recovery", async () => {
      const a = await store.enqueue(newEntry({ id: "a" }));
      const b = await store.enqueue(newEntry({ id: "b" }));
      await store.enqueue(newEntry({ id: "c" })); // stays pending
      await store.park(a.seq, "deterministic");
      await store.park(b.seq, "conflict");

      await requeueParkedEntries("u1", store);

      const all = await store.forOwner("u1");
      expect(all.every((entry) => entry.status === "pending")).toBe(true);
    });

    it("leaves another owner's parked entries alone", async () => {
      const other = await store.enqueue(newEntry({ id: "x", ownerId: "u2" }));
      await store.park(other.seq, "deterministic");

      await requeueParkedEntries("u1", store);

      expect((await store.forOwner("u2"))[0]?.status).toBe("parked");
    });
  });

  describe("discardAllEntries", () => {
    it("removes every entry for the owner and returns the count", async () => {
      await store.enqueue(newEntry({ id: "a" }));
      await store.enqueue(newEntry({ id: "b" }));

      expect(await discardAllEntries("u1", store)).toBe(2);
      expect(await store.forOwner("u1")).toHaveLength(0);
    });

    it("leaves other owners untouched", async () => {
      await store.enqueue(newEntry({ ownerId: "u2" }));

      await discardAllEntries("u1", store);

      expect(await store.forOwner("u2")).toHaveLength(1);
    });
  });
});
