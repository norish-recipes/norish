import { observable } from "@trpc/server/observable";
import { beforeEach, describe, expect, it, vi } from "vitest";

const enqueue = vi.hoisted(() => vi.fn(async () => ({})));

vi.mock("@/lib/outbox/outbox-store", () => ({ outboxStore: { enqueue } }));
vi.mock("@/lib/query-cache", () => ({
  activeCacheOwner: () => "u1",
  readBootOwner: () => null,
}));

import { createOutboxLink } from "@/lib/outbox/outbox-link";
import { OUTBOX_REPLAY_HEADER, OUTBOX_REPLAY_HEADER_VALUE } from "@/lib/outbox/replay-client";

type FakeOp = {
  type: "mutation" | "query";
  path: string;
  input: unknown;
  context: Record<string, unknown>;
};

function runLink(op: FakeOp, terminal: () => ReturnType<typeof observable>) {
  const link = createOutboxLink()({} as never);

  return new Promise<{ value?: unknown; error?: unknown }>((resolve) => {
    link({ op, next: () => terminal() } as never).subscribe({
      next: (value: unknown) => resolve({ value }),
      error: (error: unknown) => resolve({ error }),
      complete: () => resolve({}),
    });
  });
}

const errorWith = (error: unknown) => () => observable((observer) => observer.error(error));
const succeedWith = (value: unknown) => () => observable((observer) => observer.next(value));

function mutationOp(overrides: Partial<FakeOp> = {}): FakeOp {
  return {
    type: "mutation",
    path: "groceries.create",
    input: { id: "g1", name: "Milk" },
    context: { operationId: "op-1", headers: { "x-operation-id": "op-1" } },
    ...overrides,
  };
}

describe("createOutboxLink", () => {
  beforeEach(() => enqueue.mockClear());

  it("captures a mutation that failed on unreachability, then still propagates the error", async () => {
    const result = await runLink(mutationOp(), errorWith(new TypeError("Failed to fetch")));

    expect(result.error).toBeInstanceOf(TypeError);
    expect(enqueue).toHaveBeenCalledTimes(1);
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: "u1",
        path: "groceries.create",
        input: { id: "g1", name: "Milk" },
        entityId: "g1", // the client-minted create id
        operationId: "op-1",
        headers: { "x-operation-id": "op-1" },
      })
    );
  });

  it("does not capture a deterministic (non-unreachable) failure", async () => {
    const result = await runLink(mutationOp(), errorWith({ data: { httpStatus: 400 } }));

    expect(result.error).toBeDefined();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("does not re-capture a replay (marked context)", async () => {
    const op = mutationOp({
      context: { headers: { [OUTBOX_REPLAY_HEADER]: OUTBOX_REPLAY_HEADER_VALUE } },
    });

    await runLink(op, errorWith(new TypeError("Failed to fetch")));

    expect(enqueue).not.toHaveBeenCalled();
  });

  it("passes successful mutations straight through", async () => {
    const result = await runLink(mutationOp(), succeedWith({ ok: true }));

    expect(result.value).toEqual({ ok: true });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("ignores non-mutations entirely", async () => {
    const result = await runLink(
      mutationOp({ type: "query" }),
      errorWith(new TypeError("Failed to fetch"))
    );

    expect(result.error).toBeInstanceOf(TypeError);
    expect(enqueue).not.toHaveBeenCalled();
  });
});
