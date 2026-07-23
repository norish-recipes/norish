import type { ReplayOutcome } from "@/lib/outbox/error-classification";
import type { NewOutboxEntry } from "@/lib/outbox/outbox-types";
import { createOfflineIdb } from "@/lib/offline/idb";
import { createOutboxStore } from "@/lib/outbox/outbox-store";
import { createRecovery } from "@/lib/outbox/recovery";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
    store = createOutboxStore(createOfflineIdb(new IDBFactory()));
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

  it("still reconciles an empty Outbox on startup or reconnect", async () => {
    await recovery().recover();

    expect(calls).toEqual(["refetch", "warm"]);
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
