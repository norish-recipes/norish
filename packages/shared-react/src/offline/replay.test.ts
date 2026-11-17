import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ReplayOutcome } from "./error-classification";
import type { OutboxStore } from "./outbox-store";
import type { NewOutboxEntry, OutboxEntry } from "./outbox-types";
import { createOutboxStore } from "./outbox-store";
import {
  MAX_AMBIGUOUS_ATTEMPTS,
  referencesParkedEntity,
  retryDelayMs,
  runReplayPass,
} from "./replay";
import { createMemoryStorage } from "./testing/memory-storage";

function entry(overrides: Partial<NewOutboxEntry> = {}): NewOutboxEntry {
  return {
    id: "e",
    ownerId: "u1",
    path: "groceries.toggle",
    input: {},
    entityId: null,
    operationId: null,
    headers: {},
    ...overrides,
  };
}

/** A submit stub that returns a canned outcome per entry id and records calls. */
function stubSubmit(outcomes: Record<string, ReplayOutcome["kind"]>) {
  const submitted: string[] = [];
  const submit = vi.fn(async (e: OutboxEntry): Promise<ReplayOutcome> => {
    submitted.push(e.id);

    return { kind: outcomes[e.id] ?? "success" };
  });

  return { submit, submitted };
}

describe("runReplayPass", () => {
  let store: OutboxStore;

  beforeEach(() => {
    store = createOutboxStore(createMemoryStorage().outbox);
  });

  it("drops a stored entry of an excluded procedure without sending it", async () => {
    await store.enqueue(entry({ id: "a", path: "admin.testAIEndpoint", input: { apiKey: "k" } }));
    await store.enqueue(entry({ id: "b", path: "groceries.toggle" }));
    const { submit, submitted } = stubSubmit({});

    await runReplayPass({ store, submit, ownerId: "u1" });

    expect(submitted).toEqual(["b"]);
    expect(await store.loadAll()).toEqual([]);
  });

  it("removes every entry on a clean drain, in FIFO order", async () => {
    await store.enqueue(entry({ id: "a" }));
    await store.enqueue(entry({ id: "b" }));
    await store.enqueue(entry({ id: "c" }));

    const { submit, submitted } = stubSubmit({});
    const result = await runReplayPass({ store, submit, ownerId: "u1" });

    expect(submitted).toEqual(["a", "b", "c"]);
    expect(result).toMatchObject({ removed: 3, parked: 0, remaining: 0, halted: null });
    expect(await store.size("u1")).toBe(0);
  });

  it("parks a deterministic rejection and keeps draining the rest", async () => {
    await store.enqueue(entry({ id: "a" }));
    await store.enqueue(entry({ id: "b" }));

    const { submit } = stubSubmit({ a: "deterministic" });
    const result = await runReplayPass({ store, submit, ownerId: "u1" });

    expect(result).toMatchObject({ removed: 1, parked: 1, halted: null });
    expect((await store.forOwner("u1", "parked")).map((e) => e.id)).toEqual(["a"]);
    expect(await store.size("u1")).toBe(1);
  });

  it("parks a stale response as Conflicted", async () => {
    await store.enqueue(entry({ id: "a" }));

    const { submit } = stubSubmit({ a: "conflict" });
    await runReplayPass({ store, submit, ownerId: "u1" });

    expect((await store.forOwner("u1", "conflicted")).map((e) => e.id)).toEqual(["a"]);
  });

  it("halts the whole queue on UNAUTHORIZED, skipping nothing behind it", async () => {
    await store.enqueue(entry({ id: "a" }));
    await store.enqueue(entry({ id: "b" }));

    const { submit, submitted } = stubSubmit({ a: "unauthorized" });
    const result = await runReplayPass({ store, submit, ownerId: "u1" });

    expect(result.halted).toBe("unauthorized");
    expect(submitted).toEqual(["a"]); // b was never attempted
    expect(await store.size("u1")).toBe(2); // both remain pending
  });

  it("halts and keeps the entry at the head when the backend is unreachable", async () => {
    await store.enqueue(entry({ id: "a" }));
    await store.enqueue(entry({ id: "b" }));

    const { submit, submitted } = stubSubmit({ a: "unreachable" });
    const result = await runReplayPass({ store, submit, ownerId: "u1" });

    expect(result.halted).toBe("unreachable");
    expect(submitted).toEqual(["a"]);
    expect((await store.forOwner("u1", "pending")).map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("bounded-retries an ambiguous 5xx: bumps attempts and reschedules", async () => {
    await store.enqueue(entry({ id: "a" }));

    const { submit } = stubSubmit({ a: "ambiguous" });
    const result = await runReplayPass({ store, submit, ownerId: "u1" });

    expect(result.halted).toBe("retry");
    expect(result.retryAfterMs).toBe(retryDelayMs(1));
    expect((await store.forOwner("u1"))[0]!.attempts).toBe(1);
  });

  it("parks an ambiguous entry once its retry budget is exhausted", async () => {
    const e = await store.enqueue(entry({ id: "a" }));

    await store.update(e.seq, { attempts: MAX_AMBIGUOUS_ATTEMPTS - 1 });
    await store.enqueue(entry({ id: "b" }));

    const { submit } = stubSubmit({ a: "ambiguous" });
    const result = await runReplayPass({ store, submit, ownerId: "u1" });

    // a parks (exhausted), b still drains.
    expect(result.halted).toBeNull();
    expect((await store.forOwner("u1", "parked")).map((x) => x.id)).toContain("a");
    expect((await store.forOwner("u1", "parked"))[0]!.parkedReason).toBe("retries-exhausted");
  });

  it("parks a create's dependent edits with it (one broken story)", async () => {
    await store.enqueue(
      entry({ id: "create", path: "groceries.create", input: { id: "g1" }, entityId: "g1" })
    );
    await store.enqueue(
      entry({
        id: "tick",
        path: "groceries.toggle",
        input: { groceries: [{ id: "g1" }], isDone: true },
      })
    );

    const { submit, submitted } = stubSubmit({ create: "deterministic" });
    const result = await runReplayPass({ store, submit, ownerId: "u1" });

    // The dependent edit is parked without ever being submitted.
    expect(submitted).toEqual(["create"]);
    expect(result.parked).toBe(2);

    const parked = await store.forOwner("u1", "parked");

    expect(parked.find((e) => e.id === "tick")?.parkedReason).toBe("dependency");
  });

  it("parks a pending edit behind a create parked in an earlier pass", async () => {
    const create = await store.enqueue(
      entry({ id: "create", path: "groceries.create", input: { id: "g1" }, entityId: "g1" })
    );

    await store.park(create.seq, "deterministic");
    await store.enqueue(
      entry({ id: "tick", path: "groceries.toggle", input: { groceries: [{ id: "g1" }] } })
    );

    const { submit, submitted } = stubSubmit({});
    await runReplayPass({ store, submit, ownerId: "u1" });

    expect(submitted).toEqual([]); // nothing submittable — the only pending entry depends on a parked create
    expect((await store.forOwner("u1", "parked")).map((e) => e.id)).toContain("tick");
  });

  it.each([
    ["a cookbook", "cookbooks.update", "cookbooks.setMembership", { cookbookId: "c1" }],
    ["a planned item", "calendar.editItem", "calendar.deleteItem", { itemId: "c1" }],
  ])(
    "sends the writes after %s edit parked as Conflicted: its entity exists",
    async (_, path, laterPath, laterInput) => {
      await store.enqueue(entry({ id: "edit", path, input: { id: "c1" }, entityId: "c1" }));
      await store.enqueue(entry({ id: "later", path: laterPath, input: laterInput }));
      const { submit, submitted } = stubSubmit({ edit: "conflict" });

      await runReplayPass({ store, submit, ownerId: "u1" });

      expect(submitted).toEqual(["edit", "later"]);
      expect((await store.loadAll()).map((e) => [e.id, e.status])).toEqual([
        ["edit", "conflicted"],
      ]);
    }
  );

  it("sends a write behind an edit Conflicted in an earlier pass", async () => {
    const edit = await store.enqueue(
      entry({ id: "edit", path: "cookbooks.update", input: { id: "c1" }, entityId: "c1" })
    );

    await store.park(edit.seq, "conflict");
    await store.enqueue(entry({ id: "later", input: { cookbookId: "c1" } }));
    const { submit, submitted } = stubSubmit({});

    await runReplayPass({ store, submit, ownerId: "u1" });

    expect(submitted).toEqual(["later"]);
  });

  it("releases a stored write parked behind a Conflicted edit, and keeps one behind a parked create", async () => {
    const edit = await store.enqueue(
      entry({ id: "edit", path: "stores.update", input: { id: "s1" }, entityId: "s1" })
    );
    const create = await store.enqueue(
      entry({ id: "create", path: "groceries.create", input: { id: "g1" }, entityId: "g1" })
    );
    const freed = await store.enqueue(entry({ id: "freed", input: { storeId: "s1" } }));
    const held = await store.enqueue(entry({ id: "held", input: { id: "g1", storeId: "s1" } }));

    await store.park(edit.seq, "conflict");
    await store.park(create.seq, "deterministic");
    await store.park(freed.seq, "dependency");
    await store.park(held.seq, "dependency");
    const { submit, submitted } = stubSubmit({});

    await runReplayPass({ store, submit, ownerId: "u1" });

    expect(submitted).toEqual(["freed"]);
    expect((await store.loadAll()).map((e) => [e.id, e.status, e.parkedReason])).toEqual([
      ["edit", "conflicted", "conflict"],
      ["create", "parked", "deterministic"],
      ["held", "parked", "dependency"],
    ]);
  });

  it("parks a dependent edit with a replace that lands while it parks", async () => {
    const storage = createMemoryStorage();
    const { change } = storage.outbox;

    store = createOutboxStore(storage.outbox);
    const create = await store.enqueue(
      entry({ id: "create", path: "recipes.create", input: { id: "r1" }, entityId: "r1" })
    );

    await store.park(create.seq, "deterministic");
    const edit = await store.enqueue(
      entry({ id: "edit", path: "recipes.update", input: { id: "r1", name: "First" } })
    );
    let replaced = false;
    // A save replaces the edit just before the pass's first write to it.
    const replace = async () => {
      if (replaced) return;
      replaced = true;
      await change(edit.seq, (stored) => ({ ...stored, input: { id: "r1", name: "Second" } }));
    };

    storage.outbox.change = async (seq, next) => {
      await replace();

      return change(seq, next);
    };
    await runReplayPass({ store, submit: stubSubmit({}).submit, ownerId: "u1" });

    expect(replaced).toBe(true);
    expect((await storage.outbox.all()).at(-1)).toMatchObject({
      input: { id: "r1", name: "Second" },
      status: "parked",
      parkedReason: "dependency",
    });
  });

  it("only touches the given owner's entries", async () => {
    await store.enqueue(entry({ id: "mine", ownerId: "u1" }));
    await store.enqueue(entry({ id: "theirs", ownerId: "u2" }));

    const { submit, submitted } = stubSubmit({});
    await runReplayPass({ store, submit, ownerId: "u1" });

    expect(submitted).toEqual(["mine"]);
    expect(await store.size("u2")).toBe(1);
  });
});

describe("referencesParkedEntity", () => {
  it("finds an id nested in objects and arrays", () => {
    expect(referencesParkedEntity({ a: { b: ["x", "g1"] } }, new Set(["g1"]))).toBe(true);
  });

  it("is false when no id matches or the set is empty", () => {
    expect(referencesParkedEntity({ a: "g2" }, new Set(["g1"]))).toBe(false);
    expect(referencesParkedEntity({ a: "g1" }, new Set())).toBe(false);
  });

  it("does not walk into Blobs and does not loop on cycles", () => {
    const cyclic: Record<string, unknown> = { id: "g2" };

    cyclic.self = cyclic;

    expect(referencesParkedEntity({ file: new Blob(["g1"]), ...cyclic }, new Set(["g1"]))).toBe(
      false
    );
  });
});

describe("retryDelayMs", () => {
  it("backs off exponentially and caps", () => {
    expect(retryDelayMs(1)).toBe(2_000);
    expect(retryDelayMs(2)).toBe(4_000);
    expect(retryDelayMs(3)).toBe(8_000);
    expect(retryDelayMs(99)).toBe(30_000);
  });
});
