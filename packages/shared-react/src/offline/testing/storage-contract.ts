/**
 * The storage adapter contract: every client's adapter runs these cases, through the
 * engine's own Outbox store and cache manager, so no adapter quietly behaves differently.
 */

import { describe, expect, it } from "vitest";

import type { NewOutboxEntry } from "../outbox-types";
import type { OfflineStorage } from "../storage";
import { createCacheManager } from "../cache-manager";
import { readLastWarmedAt, writeLastWarmedAt } from "../last-warmed";
import { createOutboxStore } from "../outbox-store";

interface StorageContractHarness {
  /** A fresh, empty adapter over its own backing store. */
  create(): OfflineStorage | Promise<OfflineStorage>;
  /** An upload value as this client's FormData holds it. */
  makeBlob(text: string, name: string, type: string): unknown;
  /** Read a stored upload value back. */
  readBlob(value: unknown): Promise<{ text: string; name: string; type: string }>;
}

function entry(overrides: Partial<NewOutboxEntry> = {}): NewOutboxEntry {
  return {
    id: "e",
    ownerId: "u1",
    path: "groceries.create",
    input: { id: "g1", name: "Milk" },
    entityId: "g1",
    operationId: "op-1",
    headers: { "x-operation-id": "op-1" },
    ...overrides,
  };
}

export function describeOfflineStorageContract(name: string, harness: StorageContractHarness) {
  describe(`offline storage contract: ${name}`, () => {
    const outboxOf = async () => createOutboxStore((await harness.create()).outbox);

    describe("owner scoping", () => {
      it("keeps every owner's entries to that owner", async () => {
        const store = await outboxOf();

        await store.enqueue(entry({ id: "a", ownerId: "u1" }));
        await store.enqueue(entry({ id: "b", ownerId: "u2" }));
        await store.enqueue(entry({ id: "c", ownerId: "u1" }));

        expect((await store.forOwner("u1")).map((e) => e.id)).toEqual(["a", "c"]);
        expect((await store.forOwner("u2")).map((e) => e.id)).toEqual(["b"]);
        expect(await store.size("u1")).toBe(2);
        expect(await store.size()).toBe(3);
      });
    });

    describe("entry ordering", () => {
      it("keeps FIFO order and never reuses a removed entry's seq", async () => {
        const store = await outboxOf();
        const a = await store.enqueue(entry({ id: "a" }));
        const b = await store.enqueue(entry({ id: "b" }));

        await store.remove(b.seq);
        const c = await store.enqueue(entry({ id: "c" }));

        expect(a.seq).toBeLessThan(b.seq);
        expect(c.seq).toBeGreaterThan(b.seq);
        expect((await store.loadAll()).map((e) => e.id)).toEqual(["a", "c"]);
      });

      it("keeps call order for enqueues made at once", async () => {
        const store = await outboxOf();

        await Promise.all(["a", "b", "c"].map((id) => store.enqueue(entry({ id }))));

        expect((await store.loadAll()).map((e) => e.id)).toEqual(["a", "b", "c"]);
      });

      it("stores an input faithfully (a Date survives as a Date)", async () => {
        const store = await outboxOf();
        const when = new Date("2026-07-21T08:00:00.000Z");

        await store.enqueue(entry({ input: { when } }));
        const [reloaded] = await store.forOwner("u1");
        const restored = (reloaded!.input as { when: Date }).when;

        expect(restored).toBeInstanceOf(Date);
        expect(restored.toISOString()).toBe(when.toISOString());
      });

      it("keeps an entry's place when it is updated", async () => {
        const store = await outboxOf();
        const a = await store.enqueue(entry({ id: "a" }));

        await store.enqueue(entry({ id: "b" }));
        await store.update(a.seq, { attempts: 1 });

        expect((await store.forOwner("u1")).map((e) => e.id)).toEqual(["a", "b"]);
      });
    });

    describe("status transitions", () => {
      it("stores a new entry as pending with every field it was given", async () => {
        const store = await outboxOf();
        const queued = await store.enqueue(entry({ createdAt: "2026-11-05T08:00:00.000Z" }));

        expect(await store.forOwner("u1")).toEqual([
          {
            seq: queued.seq,
            id: "e",
            ownerId: "u1",
            path: "groceries.create",
            input: { id: "g1", name: "Milk" },
            entityId: "g1",
            operationId: "op-1",
            headers: { "x-operation-id": "op-1" },
            createdAt: "2026-11-05T08:00:00.000Z",
            attempts: 0,
            status: "pending",
          },
        ]);
      });

      it("parks with a reason, conflicts as Conflicted, and returns to pending", async () => {
        const store = await outboxOf();
        const rejected = await store.enqueue(entry({ id: "rejected" }));
        const conflicted = await store.enqueue(entry({ id: "conflicted" }));

        await store.update(rejected.seq, { attempts: 2 });
        await store.park(rejected.seq, "retries-exhausted");
        await store.park(conflicted.seq, "conflict");

        const [parked] = await store.forOwner("u1", "parked");

        expect(parked).toMatchObject({ id: "rejected", attempts: 2 });
        expect(parked!.parkedReason).toBe("retries-exhausted");
        expect((await store.forOwner("u1", "conflicted"))[0]!.parkedReason).toBe("conflict");

        await store.update(rejected.seq, { status: "pending", parkedReason: undefined });

        const [requeued] = await store.forOwner("u1", "pending");

        expect(requeued!.id).toBe("rejected");
        expect(requeued!.parkedReason).toBeUndefined();
      });

      it("ignores an update to an entry that is gone", async () => {
        const store = await outboxOf();
        const gone = await store.enqueue(entry());

        await store.remove(gone.seq);
        await store.update(gone.seq, { attempts: 1 });

        expect(await store.size()).toBe(0);
      });
    });

    describe("blob round-trips", () => {
      const photo = { text: "jpeg-bytes", name: "photo.jpg", type: "image/jpeg" };
      const uploadInput = () => ({
        codec: "norish-outbox/formdata@1",
        entries: [
          ["id", "r1"],
          ["image", harness.makeBlob(photo.text, photo.name, photo.type)],
        ],
      });
      const storedBlob = async (store: ReturnType<typeof createOutboxStore>) => {
        const [stored] = await store.forOwner("u1");
        const { entries } = stored!.input as { entries: [string, unknown][] };

        return harness.readBlob(entries[1]![1]);
      };

      it("reads an upload back as it was queued", async () => {
        const store = await outboxOf();

        await store.enqueue(entry({ path: "recipes.uploadImage", input: uploadInput() }));

        await expect(storedBlob(store)).resolves.toEqual(photo);
      });

      it("keeps the upload readable after the entry is parked and requeued", async () => {
        const store = await outboxOf();
        const queued = await store.enqueue(entry({ input: uploadInput() }));

        await store.park(queued.seq, "deterministic");
        await store.update(queued.seq, { status: "pending", parkedReason: undefined });

        await expect(storedBlob(store)).resolves.toEqual(photo);
      });

      it("keeps one entry's upload when another entry is removed", async () => {
        const store = await outboxOf();
        const first = await store.enqueue(entry({ id: "first", input: uploadInput() }));

        await store.enqueue(entry({ id: "second", input: uploadInput() }));
        await store.remove(first.seq);

        await expect(storedBlob(store)).resolves.toEqual(photo);
      });
    });

    describe("purge on account switch", () => {
      const cacheOf = (storage: OfflineStorage) => createCacheManager({ storage, buster: "test" });
      // A stand-in read, not a tRPC one.
      const GREETING = ["greeting"];

      /** Adopt `owner` and save a read it made. */
      async function readAs(storage: OfflineStorage, owner: string, value: string) {
        const manager = cacheOf(storage);

        await manager.reconcileIdentity({ sessionUserId: owner, isOffline: false });
        manager.queryClient.setQueryData(GREETING, value);
        await manager.flush();

        const restored = cacheOf(storage);

        await restored.reconcileIdentity({ sessionUserId: owner, isOffline: false });
        expect(restored.queryClient.getQueryData(GREETING)).toBe(value);

        return manager;
      }

      it("restores the last owner's cache on an Offline start with no session", async () => {
        const storage = await harness.create();

        await readAs(storage, "u1", "kept for u1");

        const relaunched = cacheOf(storage);

        await relaunched.reconcileIdentity({ sessionUserId: null, isOffline: true });

        expect(relaunched.owner()).toBe("u1");
        expect(relaunched.queryClient.getQueryData(GREETING)).toBe("kept for u1");
      });

      it("purges the departed owner's reads but leaves their Outbox dormant", async () => {
        const storage = await harness.create();
        const outbox = createOutboxStore(storage.outbox);
        const manager = await readAs(storage, "u1", "u1-secret");

        await writeLastWarmedAt("u1", 123, storage.keyval);
        await outbox.enqueue(entry({ ownerId: "u1" }));

        await manager.reconcileIdentity({ sessionUserId: "u2", isOffline: false });

        expect(manager.queryClient.getQueryData(GREETING)).toBeUndefined();
        expect(await readLastWarmedAt("u1", storage.keyval)).toBeNull();
        expect(await outbox.size("u1")).toBe(1);

        const relaunched = cacheOf(storage);

        await relaunched.reconcileIdentity({ sessionUserId: null, isOffline: true });
        expect(relaunched.owner()).toBe("u2");

        await relaunched.reconcileIdentity({ sessionUserId: "u1", isOffline: false });
        expect(relaunched.queryClient.getQueryData(GREETING)).toBeUndefined();
      });

      it("forgets the owner on sign-out", async () => {
        const storage = await harness.create();
        const manager = await readAs(storage, "u1", "u1-secret");

        await manager.resetOfflineCopy("sign-out");

        const relaunched = cacheOf(storage);

        await relaunched.reconcileIdentity({ sessionUserId: null, isOffline: true });
        expect(relaunched.owner()).toBeNull();
      });
    });
  });
}
