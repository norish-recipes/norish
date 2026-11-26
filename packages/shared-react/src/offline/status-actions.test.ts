import { beforeEach, describe, expect, it } from "vitest";

import type { OutboxStore } from "./outbox-store";
import type { NewOutboxEntry } from "./outbox-types";
import { createOutboxStore } from "./outbox-store";
import { discardAllEntries, requeueParkedEntries } from "./status-actions";
import { createMemoryStorage } from "./testing/memory-storage";

function newEntry(overrides: Partial<NewOutboxEntry> = {}): NewOutboxEntry {
  return {
    id: "e",
    ownerId: "u1",
    householdId: "h1",
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
    store = createOutboxStore(createMemoryStorage().outbox);
  });

  describe("requeueParkedEntries", () => {
    it("un-parks Parked and Conflicted entries for Recovery", async () => {
      const a = await store.enqueue(newEntry({ id: "a" }));
      const b = await store.enqueue(newEntry({ id: "b" }));
      await store.enqueue(newEntry({ id: "c" })); // stays pending
      await store.park(a.seq, "deterministic");
      await store.park(b.seq, "conflict");

      await requeueParkedEntries("u1", store, "h1");

      const all = await store.forOwner("u1");
      expect(all.every((entry) => entry.status === "pending")).toBe(true);
    });

    it("sends a write made for another household, and what waits on it, to the current one", async () => {
      const create = await store.enqueue(
        newEntry({ id: "a", householdId: "h-old", entityId: "g1" })
      );
      const edit = await store.enqueue(
        newEntry({ id: "b", householdId: "h-old", path: "groceries.update", input: { id: "g1" } })
      );
      const unknown = await store.enqueue(newEntry({ id: "c", householdId: null }));
      const refused = await store.enqueue(newEntry({ id: "d", householdId: "h-old" }));
      await store.park(create.seq, "other-household");
      await store.park(edit.seq, "dependency");
      await store.park(unknown.seq, "other-household");
      await store.park(refused.seq, "deterministic");

      await requeueParkedEntries("u1", store, "h1");

      expect((await store.forOwner("u1")).map((e) => [e.id, e.status, e.householdId])).toEqual([
        ["a", "pending", "h1"],
        ["b", "pending", "h1"],
        ["c", "pending", "h1"],
        ["d", "pending", "h-old"],
      ]);
    });

    it("leaves another owner's parked entries alone", async () => {
      const other = await store.enqueue(newEntry({ id: "x", ownerId: "u2" }));
      await store.park(other.seq, "deterministic");

      await requeueParkedEntries("u1", store, "h1");

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
