import type { ReplayOutcome } from "@/lib/outbox/error-classification";
import type { OutboxStore } from "@/lib/outbox/outbox-store";
import type { NewOutboxEntry, OutboxEntry } from "@/lib/outbox/outbox-types";
import { createOfflineIdb } from "@/lib/offline/idb";
import { createOutboxStore } from "@/lib/outbox/outbox-store";
import {
  MAX_AMBIGUOUS_ATTEMPTS,
  processQueue,
  referencesParkedEntity,
  retryDelayMs,
  runReplayPass,
  setReplayOwnerResolver,
  setReplaySessionGuard,
  setReplaySubmit,
} from "@/lib/outbox/replay";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  accumulateGroceryAmounts,
  buildGroceryMergeIndex,
  findGroceryMergeTarget,
} from "@norish/shared/lib/grocery-merge";

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
    store = createOutboxStore(createOfflineIdb(new IDBFactory()));
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
    expect((await store.forOwner("u1"))[0].attempts).toBe(1);
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
    expect((await store.forOwner("u1", "parked"))[0].parkedReason).toBe("retries-exhausted");
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

  it("only touches the given owner's entries", async () => {
    await store.enqueue(entry({ id: "mine", ownerId: "u1" }));
    await store.enqueue(entry({ id: "theirs", ownerId: "u2" }));

    const { submit, submitted } = stubSubmit({});
    await runReplayPass({ store, submit, ownerId: "u1" });

    expect(submitted).toEqual(["mine"]);
    expect(await store.size("u2")).toBe(1);
  });

  it("applies a learned client-to-canonical substitution to later queued entries", async () => {
    const clientId = "11111111-1111-4111-8111-111111111111";
    const canonicalId = "22222222-2222-4222-8222-222222222222";

    await store.enqueue(
      entry({
        id: "create",
        path: "groceries.create",
        input: [{ id: clientId }],
        entityId: clientId,
      })
    );
    await store.enqueue(
      entry({
        id: "tick",
        path: "groceries.toggle",
        input: { groceries: [{ id: clientId, version: 1 }], isDone: true },
        entityId: clientId,
      })
    );

    const inputsSeen: unknown[] = [];
    const submit = vi.fn(async (e: OutboxEntry): Promise<ReplayOutcome> => {
      inputsSeen.push(e.input);

      if (e.id === "create") {
        // The server merged the client-minted row into an existing canonical one.
        return {
          kind: "success",
          result: { ids: [canonicalId], idSubstitutions: [{ clientId, canonicalId }] },
        };
      }

      return { kind: "success" };
    });

    const result = await runReplayPass({ store, submit, ownerId: "u1" });

    expect(result).toMatchObject({ removed: 2, parked: 0, remaining: 0 });
    // The dependent toggle was submitted with the canonical id, not the stale
    // client-minted one.
    expect(inputsSeen[1]).toEqual({
      groceries: [{ id: canonicalId, version: 1 }],
      isDone: true,
    });
  });

  it("persists substitution rewrites so a halted queue resumes correct", async () => {
    const clientId = "11111111-1111-4111-8111-111111111111";
    const canonicalId = "22222222-2222-4222-8222-222222222222";

    await store.enqueue(
      entry({
        id: "create",
        path: "groceries.create",
        input: [{ id: clientId }],
        entityId: clientId,
      })
    );
    await store.enqueue(
      entry({
        id: "tick",
        path: "groceries.toggle",
        input: { groceries: [{ id: clientId, version: 1 }] },
        entityId: clientId,
      })
    );

    const submit = vi.fn(async (e: OutboxEntry): Promise<ReplayOutcome> => {
      if (e.id === "create") {
        return {
          kind: "success",
          result: { ids: [canonicalId], idSubstitutions: [{ clientId, canonicalId }] },
        };
      }

      // The backend drops away again before the dependent replays.
      return { kind: "unreachable" };
    });

    const result = await runReplayPass({ store, submit, ownerId: "u1" });

    expect(result.halted).toBe("unreachable");

    // The stored entry — input and dependency metadata — was rewritten, so a
    // later pass (even after reload) targets the canonical id.
    const [pending] = await store.forOwner("u1", "pending");

    expect(pending?.input).toEqual({ groceries: [{ id: canonicalId, version: 1 }] });
    expect(pending?.entityId).toBe(canonicalId);
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

describe("stale grocery merge across Replay (ADR-0009)", () => {
  let store: OutboxStore;

  beforeEach(() => {
    store = createOutboxStore(createOfflineIdb(new IDBFactory()));
  });

  it("merges the queued create into the concurrent canonical row and follows with the edit", async () => {
    const canonicalId = "22222222-2222-4222-8222-222222222222";
    const clientId = "11111111-1111-4111-8111-111111111111";

    // Another client created the canonical row after this client's cache went
    // stale; the authoritative state the server double runs the shared rule
    // against contains it.
    type Row = {
      id: string;
      name: string | null;
      unit: string | null;
      amount: number | null;
      isDone: boolean;
      version: number;
    };
    const serverRows = new Map<string, Row>([
      [
        canonicalId,
        { id: canonicalId, name: "Milk", unit: null, amount: 2, isDone: false, version: 1 },
      ],
    ]);

    // The stale client queued a matching create and a dependent edit.
    await store.enqueue(
      entry({
        id: "create",
        path: "groceries.create",
        input: [{ id: clientId, name: "milk", unit: null, amount: 1, isDone: false }],
        entityId: clientId,
      })
    );
    await store.enqueue(
      entry({
        id: "tick",
        path: "groceries.toggle",
        input: { groceries: [{ id: clientId, version: 1 }], isDone: true },
        entityId: clientId,
      })
    );

    // A server double faithful to the shared contract: the same pure merge
    // rule the real createGroceriesData runs, reporting idSubstitutions.
    const submit = async (e: OutboxEntry): Promise<ReplayOutcome> => {
      if (e.path === "groceries.create") {
        const items = e.input as Array<{
          id: string;
          name: string | null;
          unit: string | null;
          amount: number | null;
          isDone: boolean;
        }>;
        const index = buildGroceryMergeIndex([...serverRows.values()]);
        const idSubstitutions = items.map((item) => {
          const target = findGroceryMergeTarget(index, item);

          if (target) {
            const row = serverRows.get(target.id)!;

            serverRows.set(row.id, {
              ...row,
              amount: accumulateGroceryAmounts(row.amount, item.amount),
              version: row.version + 1,
            });

            return { clientId: item.id, canonicalId: target.id };
          }

          serverRows.set(item.id, { ...item, version: 1 });

          return { clientId: item.id, canonicalId: item.id };
        });

        return {
          kind: "success",
          result: { ids: idSubstitutions.map((s) => s.canonicalId), idSubstitutions },
        };
      }

      const { groceries, isDone } = e.input as {
        groceries: Array<{ id: string }>;
        isDone: boolean;
      };

      for (const { id } of groceries) {
        const row = serverRows.get(id);

        if (!row) return { kind: "deterministic" };
        serverRows.set(id, { ...row, isDone, version: row.version + 1 });
      }

      return { kind: "success" };
    };

    const result = await runReplayPass({ store, submit, ownerId: "u1" });

    expect(result).toMatchObject({ removed: 2, parked: 0, remaining: 0, halted: null });

    // One merged grocery — accumulated, completed, no duplicate row.
    expect(serverRows.size).toBe(1);
    expect(serverRows.get(canonicalId)).toMatchObject({ amount: 3, isDone: true });
    expect(serverRows.has(clientId)).toBe(false);
  });
});

describe("processQueue session guard (ADR-0009)", () => {
  let store: OutboxStore;

  beforeEach(() => {
    store = createOutboxStore(createOfflineIdb(new IDBFactory()));
  });

  afterEach(() => {
    setReplaySubmit(null);
    setReplayOwnerResolver(null);
    setReplaySessionGuard(null);
  });

  it("submits nothing when the live session belongs to someone else — the queue stays dormant", async () => {
    await store.enqueue(entry({ id: "a", ownerId: "u1" }));

    const submit = vi.fn(async (): Promise<ReplayOutcome> => ({ kind: "success" }));

    setReplaySubmit(submit);
    setReplayOwnerResolver(() => "u1");
    // The transport cookies now belong to another account (bypassed switch).
    setReplaySessionGuard(async () => "mismatch");

    await processQueue(store);

    expect(submit).not.toHaveBeenCalled();
    expect(await store.size("u1")).toBe(1);
    expect((await store.forOwner("u1", "pending")).length).toBe(1);
  });

  it("drains normally when the session matches or cannot be verified", async () => {
    await store.enqueue(entry({ id: "a", ownerId: "u1" }));

    const submit = vi.fn(async (): Promise<ReplayOutcome> => ({ kind: "success" }));

    setReplaySubmit(submit);
    setReplayOwnerResolver(() => "u1");
    setReplaySessionGuard(async () => "match");

    await processQueue(store);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(await store.size("u1")).toBe(0);

    await store.enqueue(entry({ id: "b", ownerId: "u1" }));
    // Offline: the session cannot be checked; the pass proceeds and halts on
    // transport unreachability as before.
    setReplaySessionGuard(async () => "unverifiable");

    await processQueue(store);
    expect(submit).toHaveBeenCalledTimes(2);
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
