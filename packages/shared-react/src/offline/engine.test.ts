import { observable } from "@trpc/server/observable";
import { describe, expect, it, vi } from "vitest";

import { isQueuedOutboxSignal } from "@norish/shared/lib/trpc-errors";

import type { OfflineStorage } from "./storage";
import { createOfflineEngine } from "./engine";
import { OUTBOX_REPLAY_HEADER } from "./replay-client";
import { createMemoryStorage } from "./testing/memory-storage";

function engineOver(storage: OfflineStorage = createMemoryStorage()) {
  return createOfflineEngine({
    storage,
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

describe("createOfflineEngine", () => {
  it("queues an unreachable mutation under the applied owner", async () => {
    const engine = engineOver();

    await engine.cache.reconcileIdentity({ sessionUserId: "u1", isOffline: false });
    const error = await mutateUnreachable(engine, { id: "g1" });

    expect(isQueuedOutboxSignal(error)).toBe(true);
    expect((await engine.outbox.forOwner("u1")).map((entry) => entry.entityId)).toEqual(["g1"]);
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
