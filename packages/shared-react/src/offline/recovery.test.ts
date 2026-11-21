import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ReplayOutcome } from "./error-classification";
import type { NewOutboxEntry } from "./outbox-types";
import { createOutboxStore } from "./outbox-store";
import { createRecovery } from "./recovery";
import { createMemoryStorage } from "./testing/memory-storage";

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

describe("Recovery", () => {
  let store: ReturnType<typeof createOutboxStore>;
  let calls: string[];
  let submit: ReturnType<typeof vi.fn<(entry: unknown) => Promise<ReplayOutcome>>>;
  let refetchActiveQueries: ReturnType<typeof vi.fn<() => Promise<void>>>;
  let topUp: ReturnType<typeof vi.fn<() => Promise<"complete">>>;

  beforeEach(() => {
    store = createOutboxStore(createMemoryStorage().outbox);
    calls = [];
    submit = vi.fn(async () => {
      calls.push("replay");

      return { kind: "success" };
    });
    refetchActiveQueries = vi.fn(async () => {
      calls.push("refetch");
    });
    topUp = vi.fn(async () => {
      calls.push("warm");

      return "complete" as const;
    });
  });

  function recovery(overrides: Partial<Parameters<typeof createRecovery>[0]> = {}) {
    return createRecovery({
      store,
      owner: () => "u1",
      submit,
      verifySession: async () => "match",
      refetchActiveQueries,
      topUp,
      wait: async () => {},
      ...overrides,
    });
  }

  it("replays to a terminal batch, refetches active queries, then tops up", async () => {
    await store.enqueue(entry());

    await recovery().recover();

    expect(calls).toEqual(["replay", "refetch", "warm"]);
    expect(await store.size("u1")).toBe(0);
  });

  it("tells once about the edits a batch found refused, before the reads refresh", async () => {
    const onConflicted = vi.fn(() => calls.push("told"));

    await store.enqueue(
      entry({ id: "a", path: "recipes.update", input: { id: "r1", version: 5 } })
    );
    await store.enqueue(
      entry({ id: "b", path: "recipes.update", input: { id: "r1", version: 5 } })
    );
    submit.mockResolvedValue({ kind: "conflict" });

    const run = recovery();

    run.subscribeConflicts(onConflicted);
    await run.recover();

    expect(onConflicted).toHaveBeenCalledTimes(1);
    expect(await store.forOwner("u1", "conflicted")).toHaveLength(2);
    expect(calls).toEqual(["told", "refetch", "warm"]);
  });

  it("tells nothing when every edit landed", async () => {
    const onConflicted = vi.fn();

    const run = recovery();

    run.subscribeConflicts(onConflicted);
    await store.enqueue(entry());
    await run.recover();

    expect(onConflicted).not.toHaveBeenCalled();
  });

  it("tells a refusal reported outside a run at once", () => {
    const onConflicted = vi.fn();
    const run = recovery();

    run.subscribeConflicts(onConflicted);
    run.reportConflict();

    expect(onConflicted).toHaveBeenCalledTimes(1);
  });

  it("tells a live refusal and a batch's in one, however they fall in the run", async () => {
    const onConflicted = vi.fn();
    let run: ReturnType<typeof recovery> | null = null;

    await store.enqueue(entry({ id: "a", path: "recipes.update", input: { id: "r1" } }));
    submit.mockImplementation(async () => {
      run?.reportConflict();

      return { kind: "conflict" };
    });
    refetchActiveQueries.mockImplementation(async () => run?.reportConflict());
    run = recovery();
    run.subscribeConflicts(onConflicted);
    await run.recover();
    run.reportConflict();

    expect(onConflicted).toHaveBeenCalledTimes(2);
  });

  it("still reconciles an empty Outbox on startup or reconnect", async () => {
    await recovery().recover();

    expect(calls).toEqual(["refetch", "warm"]);
  });

  it("does not refresh reads on startup when Replay sent nothing", async () => {
    // The page's own first fetches already read the live server; asking again
    // here is what made every hard load fetch the whole page twice.
    await recovery().recover("startup");

    expect(calls).toEqual(["warm"]);
    expect(refetchActiveQueries).not.toHaveBeenCalled();
  });

  it("refreshes reads on startup when Replay actually sent something", async () => {
    await store.enqueue(entry());

    await recovery().recover("startup");

    expect(calls).toEqual(["replay", "refetch", "warm"]);
  });

  it("does not refresh reads for a queued admission when Replay sent nothing", async () => {
    // A mutation admitted while Live: the reads never fell behind, so the run
    // owes them nothing unless it actually delivers the write.
    await recovery().recover("queued");

    expect(calls).toEqual(["warm"]);
  });

  it("refreshes reads once a queued admission is delivered", async () => {
    await store.enqueue(entry());

    await recovery().recover("queued");

    expect(calls).toEqual(["replay", "refetch", "warm"]);
  });

  it("refreshes reads on a resync even with an empty Outbox", async () => {
    await recovery().recover("resync");

    expect(calls).toEqual(["refetch", "warm"]);
  });

  it("takes the stronger reason when a resync coalesces into a startup run", async () => {
    const instance = recovery();
    const first = instance.recover("startup");

    void instance.recover("resync");
    await first;

    expect(refetchActiveQueries).toHaveBeenCalled();
  });

  it("owns bounded retry continuation before the final reconciliation", async () => {
    await store.enqueue(entry());
    const waits: number[] = [];

    submit
      .mockResolvedValueOnce({ kind: "ambiguous" })
      .mockResolvedValueOnce({ kind: "ambiguous" })
      .mockResolvedValueOnce({ kind: "success" });

    await recovery({ wait: async (delayMs) => void waits.push(delayMs) }).recover();

    expect(submit).toHaveBeenCalledTimes(3);
    expect(waits).toEqual([2_000, 4_000]);
    expect(calls.slice(-2)).toEqual(["refetch", "warm"]);
  });

  it("keeps draining when a pass discovers newly appended pending work", async () => {
    await store.enqueue(entry({ id: "first", entityId: "g1" }));
    submit.mockImplementationOnce(async () => {
      calls.push("replay");
      await store.enqueue(entry({ id: "second", entityId: "g2", input: { id: "g2" } }));

      return { kind: "success" };
    });

    await recovery().recover();

    expect(submit).toHaveBeenCalledTimes(2);
    expect(await store.size("u1")).toBe(0);
    expect(calls).toEqual(["replay", "replay", "refetch", "warm"]);
  });

  it("does not reconcile a batch halted by transport or an identity mismatch", async () => {
    await store.enqueue(entry());
    submit.mockResolvedValueOnce({ kind: "unreachable" });

    await recovery().recover();

    expect(refetchActiveQueries).not.toHaveBeenCalled();
    expect(topUp).not.toHaveBeenCalled();

    submit.mockClear();
    await recovery({ verifySession: async () => "mismatch" }).recover();

    expect(submit).not.toHaveBeenCalled();
    expect(refetchActiveQueries).not.toHaveBeenCalled();
  });

  it("shares one in-flight run and exposes only isSyncing", async () => {
    let finishRefetch: (() => void) | undefined;
    const recoveryInstance = recovery({
      refetchActiveQueries: vi
        .fn<() => Promise<void>>()
        .mockImplementationOnce(
          () =>
            new Promise<void>((resolve) => {
              finishRefetch = resolve;
            })
        )
        .mockResolvedValue(undefined),
    });
    const syncing: boolean[] = [];

    recoveryInstance.subscribe(() => syncing.push(recoveryInstance.isSyncing()));

    const first = recoveryInstance.recover();
    const second = recoveryInstance.recover();

    expect(second).toBe(first);
    expect(recoveryInstance.isSyncing()).toBe(true);

    await vi.waitFor(() => expect(finishRefetch).toBeTypeOf("function"));
    finishRefetch?.();
    await first;

    expect(recoveryInstance.isSyncing()).toBe(false);
    expect(syncing).toEqual([true, false]);
  });

  it("runs a requested follow-up before the shared in-flight promise settles", async () => {
    let finishFirstRefetch: (() => void) | undefined;
    const controlledRefetch = vi
      .fn<() => Promise<void>>()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finishFirstRefetch = resolve;
          })
      )
      .mockImplementation(async () => {
        calls.push("refetch");
      });
    const recoveryInstance = recovery({ refetchActiveQueries: controlledRefetch });
    const first = recoveryInstance.recover();

    await vi.waitFor(() => expect(finishFirstRefetch).toBeTypeOf("function"));
    await store.enqueue(entry());
    const followUp = recoveryInstance.recover();

    expect(followUp).toBe(first);
    finishFirstRefetch?.();
    await first;

    expect(submit).toHaveBeenCalledTimes(1);
    expect(controlledRefetch).toHaveBeenCalledTimes(2);
    expect(topUp).toHaveBeenCalledTimes(2);
    expect(await store.size("u1")).toBe(0);
  });
});
