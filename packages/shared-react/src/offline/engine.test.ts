import { observable } from "@trpc/server/observable";
import { describe, expect, it, vi } from "vitest";

import { isQueuedOutboxSignal } from "@norish/shared/lib/trpc-errors";

import type { LockManagerLike } from "./leader";
import type { OutboxEntry } from "./outbox-types";
import type { OfflineStorage } from "./storage";
import { createOfflineEngine } from "./engine";
import { MUTATION_SEND_TIMEOUT_MS } from "./outbox-link";
import { runReplayPass } from "./replay";
import { OUTBOX_REPLAY_HEADER } from "./replay-client";
import { createMemoryStorage } from "./testing/memory-storage";

function engineOver(
  storage: OfflineStorage = createMemoryStorage(),
  locks?: () => LockManagerLike | null
) {
  return createOfflineEngine({
    storage,
    locks,
    replayHeaderValue: "test-outbox",
    probeUrl: () => "/api/v1/health/ready",
    buster: "test",
    calendarRanges: () => [],
  });
}

/** Run one mutation through the engine's Outbox link over a transport that fails it. */
function mutateUnreachable(engine: ReturnType<typeof engineOver>, input: unknown) {
  const link = engine.outboxLink({} as never);

  return new Promise<unknown>((resolve) => {
    link({
      op: { type: "mutation", path: "groceries.create", input, context: {} },
      next: () => observable((observer) => observer.error(new TypeError("Failed to fetch"))),
    } as never).subscribe({ error: resolve });
  });
}

const recipeId = "11111111-1111-4111-8111-111111111111";
const edit = (name: string, version = 3) => ({ id: recipeId, version, data: { name } });
const unreachable = () =>
  observable((observer) => observer.error(new TypeError("Failed to fetch")));

/** Save a recipe through the engine's Outbox link; resolves with its answer or error. */
function saveRecipe(
  engine: ReturnType<typeof engineOver>,
  input: ReturnType<typeof edit>,
  next: () => ReturnType<typeof observable>
) {
  const operationId = input.data.name;

  return new Promise<{ value?: unknown; error?: unknown }>((resolve) =>
    engine
      .outboxLink({} as never)({
        op: {
          type: "mutation",
          path: "recipes.update",
          input,
          context: { operationId, headers: { "x-operation-id": operationId } },
        },
        next,
      } as never)
      .subscribe({
        next: (value: unknown) => resolve({ value }),
        error: (error: unknown) => resolve({ error }),
        complete: () => resolve({}),
      })
  );
}

describe("createOfflineEngine", () => {
  it("stores a queued write at once while a read-cache save waits on its throttle", async () => {
    vi.useFakeTimers();
    const storage = createMemoryStorage();
    const engine = engineOver(storage);
    const set = vi.spyOn(storage.keyval, "set");

    try {
      await engine.cache.reconcileIdentity({ sessionUserId: "u1", isOffline: false });
      engine.queryClient.setQueryData(["groceries"], []);
      await mutateUnreachable(engine, { id: "g1" });

      expect(await storage.outbox.all()).toHaveLength(1);
      expect(set).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("queues an unreachable mutation under the applied owner", async () => {
    const engine = engineOver();

    await engine.cache.reconcileIdentity({ sessionUserId: "u1", isOffline: false });
    const error = await mutateUnreachable(engine, { id: "g1" });

    expect(isQueuedOutboxSignal(error)).toBe(true);
    expect((await engine.outbox.forOwner("u1")).map((entry) => entry.entityId)).toEqual(["g1"]);
  });

  it("times out every write that shares a scope, and no other mutation", async () => {
    const engine = engineOver();

    await engine.cache.reconcileIdentity({ sessionUserId: "u1", isOffline: false });
    vi.useFakeTimers();
    try {
      for (const path of [
        "groceries.toggle",
        "stores.update",
        "stores.reorder",
        "calendar.moveItem",
        "user.setDevicePreferences",
        "user.updatePreferences",
        "user.updateName",
        "user.uploadAvatar",
        "user.deleteAvatar",
        "recipes.update",
        "admin.testAIEndpoint",
      ]) {
        engine
          .outboxLink({} as never)({
            op: { type: "mutation", path, input: { id: path }, context: {} },
            next: () => observable(() => {}),
          } as never)
          .subscribe({ error: () => {} });
      }
      await vi.advanceTimersByTimeAsync(MUTATION_SEND_TIMEOUT_MS * 10);
    } finally {
      vi.useRealTimers();
    }

    expect((await engine.outbox.loadAll()).map((entry) => entry.path)).toEqual([
      "groceries.toggle",
      "stores.update",
      "stores.reorder",
      "calendar.moveItem",
      "user.setDevicePreferences",
      "user.updatePreferences",
      "user.updateName",
      "user.uploadAvatar",
      "user.deleteAvatar",
    ]);
  });

  it("tells the Recovery's listeners of a recipe save refused live, and stores nothing", async () => {
    const engine = engineOver();
    const told = vi.fn();
    const recovery = engine.createRecovery({
      transport: {},
      verifySession: async () => "match",
      refetchActiveQueries: async () => {},
      topUp: async () => {},
    });

    await engine.cache.reconcileIdentity({ sessionUserId: "u1", isOffline: false });
    recovery.subscribeConflicts(told);
    await saveRecipe(engine, edit("Mine", 2), () =>
      observable((observer) => {
        observer.next({ result: { data: { stale: true, version: null } } });
        observer.complete();
      })
    );

    expect(told).toHaveBeenCalledTimes(1);
    expect(await engine.outbox.size("u1")).toBe(0);
    await expect(engine.unsyncedChanges()).resolves.toBe(0);
  });

  describe("a recipe save beside Replay", () => {
    const pending = (input: unknown, path = "recipes.update") => ({
      id: path,
      ownerId: "u1",
      path,
      input,
      entityId: null,
      operationId: null,
      headers: {},
    });
    const settledSoon = <T>(promise: Promise<T>) =>
      Promise.race([promise, new Promise((resolve) => setTimeout(() => resolve("waiting"), 50))]);
    const inputs = async (engine: ReturnType<typeof engineOver>) =>
      (await engine.outbox.loadAll()).map((entry) => entry.input);

    it("is stored at once while the Cache Warmer holds the Outbox lock", async () => {
      const held: LockManagerLike = { request: () => new Promise(() => {}) };
      const engine = engineOver(createMemoryStorage(), () => held);

      await engine.cache.reconcileIdentity({ sessionUserId: "u1", isOffline: false });
      await engine.outbox.enqueue(pending(edit("First")));

      const saved = await settledSoon(saveRecipe(engine, edit("Second", 4), unreachable));

      expect(saved).not.toBe("waiting");
      expect(await inputs(engine)).toEqual([edit("Second", 3)]);
    });

    it("is stored at once while a Replay pass sends another entry", async () => {
      const engine = engineOver();
      let release = () => {};
      const update = vi.fn(async (_input: unknown) => ({ stale: false, version: 4 }));
      const recovery = engine.createRecovery({
        transport: {
          groceries: {
            create: { mutate: () => new Promise((resolve) => (release = () => resolve({}))) },
          },
          recipes: { update: { mutate: update } },
        },
        verifySession: async () => "match",
        refetchActiveQueries: async () => {},
        topUp: async () => {},
      });

      await engine.cache.reconcileIdentity({ sessionUserId: "u1", isOffline: false });
      await engine.outbox.enqueue(pending({ id: "g1" }, "groceries.create"));
      await engine.outbox.enqueue(pending(edit("First")));
      const replaying = recovery.recover();

      await new Promise((resolve) => setTimeout(resolve, 0));
      const saved = await settledSoon(saveRecipe(engine, edit("Second", 4), unreachable));

      expect(saved).not.toBe("waiting");
      expect((await inputs(engine)).at(-1)).toEqual(edit("Second", 3));
      release();
      await replaying;
      expect(update.mock.calls.map(([input]) => input)).toEqual([edit("Second", 3)]);
    });

    it("never changes the entry Replay is sending, and loses no edit", async () => {
      const engine = engineOver();
      const sent: unknown[] = [];
      let answer = (_outcome: "success") => {};

      await engine.cache.reconcileIdentity({ sessionUserId: "u1", isOffline: false });
      await engine.outbox.enqueue(pending(edit("First")));
      const submit = vi.fn(async (entry: OutboxEntry) => {
        sent.push(entry.input);
        if (sent.length > 1) return { kind: "success" as const };

        return new Promise<{ kind: "success" }>(
          (resolve) => (answer = (kind) => resolve({ kind }))
        );
      });
      const sending = runReplayPass({ store: engine.outbox, submit, ownerId: "u1" });

      await new Promise((resolve) => setTimeout(resolve, 0));
      await saveRecipe(engine, edit("Second"), unreachable);
      answer("success");
      await sending;
      await runReplayPass({ store: engine.outbox, submit, ownerId: "u1" });

      expect(sent).toEqual([edit("First"), edit("Second")]);
      expect(await engine.outbox.size("u1")).toBe(0);
    });

    // The accepted gap: a send whose answer was lost may have landed, so its replacement is refused.
    it("refuses a replacement of a save that reached the server unanswered, told once", async () => {
      const engine = engineOver();
      const told = vi.fn();
      const server = { version: 3, name: "Original" };
      let dropAnswer = true;
      const update = vi.fn(async (input: { version: number; data: { name: string } }) => {
        if (input.version !== server.version) return { stale: true, version: null };
        Object.assign(server, { version: server.version + 1, name: input.data.name });
        if (dropAnswer) {
          dropAnswer = false;
          throw new TypeError("Failed to fetch");
        }

        return { stale: false, version: server.version };
      });
      const recovery = engine.createRecovery({
        transport: { recipes: { update: { mutate: update } } },
        verifySession: async () => "match",
        refetchActiveQueries: async () => {},
        topUp: async () => {},
      });

      await engine.cache.reconcileIdentity({ sessionUserId: "u1", isOffline: false });
      recovery.subscribeConflicts(told);
      await saveRecipe(engine, edit("First"), unreachable);
      await recovery.recover();
      expect(await engine.outbox.loadAll()).toMatchObject([
        { input: edit("First"), attempts: 0, status: "pending" },
      ]);

      await saveRecipe(engine, edit("Second"), unreachable);
      await recovery.recover();

      expect(update.mock.calls.map(([input]) => input)).toEqual([edit("First"), edit("Second")]);
      expect(server).toEqual({ version: 4, name: "First" });
      expect(await engine.outbox.loadAll()).toMatchObject([
        { input: edit("Second"), status: "conflicted", parkedReason: "conflict" },
      ]);
      expect(told).toHaveBeenCalledTimes(1);
    });
  });

  it("replays only the applied owner's queue, marked with the client's replay header", async () => {
    const engine = engineOver();
    const mutate = vi.fn(async (_input: unknown, _opts: unknown) => ({ success: true }));

    await engine.outbox.enqueue({
      id: "dormant",
      ownerId: "u0",
      path: "groceries.create",
      input: { id: "g0" },
      entityId: "g0",
      operationId: null,
      headers: {},
    });
    await engine.cache.reconcileIdentity({ sessionUserId: "u1", isOffline: false });
    await mutateUnreachable(engine, { id: "g1" });

    await engine
      .createRecovery({
        transport: { groceries: { create: { mutate } } },
        verifySession: async () => "match",
        refetchActiveQueries: async () => {},
        topUp: async () => {},
      })
      .recover();

    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0]![0]).toEqual({ id: "g1" });
    expect(mutate.mock.calls[0]![1]).toMatchObject({
      context: { headers: { [OUTBOX_REPLAY_HEADER]: "test-outbox" } },
    });
    expect(await engine.outbox.size("u1")).toBe(0);
    // Another owner's queue stays dormant until that owner signs in again (ADR-0009).
    expect(await engine.outbox.size("u0")).toBe(1);
  });

  it("retries and discards an owner's parked work", async () => {
    const engine = engineOver();
    const parked = await engine.outbox.enqueue({
      id: "p",
      ownerId: "u1",
      path: "groceries.create",
      input: {},
      entityId: null,
      operationId: null,
      headers: {},
    });

    await engine.outbox.park(parked.seq, "deterministic");
    await engine.requeueParked("u1");
    expect((await engine.outbox.forOwner("u1", "pending")).map((entry) => entry.id)).toEqual(["p"]);

    await expect(engine.discardAll("u1")).resolves.toBe(1);
    expect(await engine.outbox.size()).toBe(0);
  });

  describe("signing out (ADR-0009)", () => {
    const entry = (id: string, ownerId = "u1") => ({
      id,
      ownerId,
      path: "groceries.create",
      input: { id },
      entityId: id,
      operationId: null,
      headers: {},
    });

    it("counts the signed-in owner's unsynced changes, parked included", async () => {
      const engine = engineOver();

      await engine.cache.reconcileIdentity({ sessionUserId: "u1", isOffline: false });
      await engine.outbox.enqueue(entry("a"));
      const parked = await engine.outbox.enqueue(entry("p"));

      await engine.outbox.park(parked.seq, "deterministic");
      await engine.outbox.enqueue(entry("x", "someone-else"));

      await expect(engine.unsyncedChanges()).resolves.toBe(2);
    });

    it("counts nothing before anyone signed in", async () => {
      const engine = engineOver();

      await engine.outbox.enqueue(entry("a"));

      await expect(engine.unsyncedChanges()).resolves.toBe(0);
    });

    it("drops the read copy but keeps the queue unless the user confirmed discarding it", async () => {
      const engine = engineOver();

      await engine.cache.reconcileIdentity({ sessionUserId: "u1", isOffline: false });
      engine.queryClient.setQueryData(["groceries"], ["milk"]);
      await engine.outbox.enqueue(entry("a"));

      await engine.clearForSignOut({ discardQueue: false });

      expect(engine.queryClient.getQueryData(["groceries"])).toBeUndefined();
      expect(engine.cache.owner()).toBeNull();
      expect(await engine.outbox.size("u1")).toBe(1);
    });

    it("discards only the signed-in owner's queue once confirmed", async () => {
      const engine = engineOver();

      await engine.cache.reconcileIdentity({ sessionUserId: "u1", isOffline: false });
      await engine.outbox.enqueue(entry("a"));
      await engine.outbox.enqueue(entry("dormant", "someone-else"));

      await engine.clearForSignOut({ discardQueue: true });

      expect(await engine.outbox.size("u1")).toBe(0);
      expect(await engine.outbox.size("someone-else")).toBe(1);
    });

    it("resets the read copy even when discarding the queue fails, and still rejects", async () => {
      const engine = engineOver();

      await engine.cache.reconcileIdentity({ sessionUserId: "u1", isOffline: false });
      engine.queryClient.setQueryData(["groceries"], ["milk"]);
      await engine.outbox.enqueue(entry("a"));
      vi.spyOn(engine.outbox, "forOwner").mockRejectedValue(new Error("quota"));

      await expect(engine.clearForSignOut({ discardQueue: true })).rejects.toThrow("quota");

      expect(engine.queryClient.getQueryData(["groceries"])).toBeUndefined();
      expect(engine.cache.owner()).toBeNull();
    });

    it("replays a signed-out owner's queue only once that owner signs back in", async () => {
      const engine = engineOver();
      const mutate = vi.fn(async (_input: unknown, _opts: unknown) => ({ success: true }));
      const recovery = engine.createRecovery({
        transport: { groceries: { create: { mutate } } },
        verifySession: async () => "match",
        refetchActiveQueries: async () => {},
        topUp: async () => {},
      });

      await engine.cache.reconcileIdentity({ sessionUserId: "u1", isOffline: false });
      await engine.outbox.enqueue(entry("a"));
      await engine.clearForSignOut({ discardQueue: false });

      await engine.cache.reconcileIdentity({ sessionUserId: "u2", isOffline: false });
      await recovery.recover();
      expect(mutate).not.toHaveBeenCalled();

      await engine.cache.reconcileIdentity({ sessionUserId: "u1", isOffline: false });
      await recovery.recover();
      expect(mutate.mock.calls.map(([input]) => input)).toEqual([{ id: "a" }]);
      expect(await engine.outbox.size("u1")).toBe(0);
    });
  });

  it("probes the client's readiness URL", async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true }) as Response);

    await expect(engineOver().probe({ fetchImpl, now: () => 1 })).resolves.toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith("/api/v1/health/ready?_probe=1", expect.anything());
  });
});
