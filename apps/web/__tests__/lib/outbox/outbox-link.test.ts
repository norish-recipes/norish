import { isEncodedFormData } from "@/lib/outbox/input-codec";
import { createOutboxLink } from "@/lib/outbox/outbox-link";
import { OUTBOX_REPLAY_HEADER, OUTBOX_REPLAY_HEADER_VALUE } from "@/lib/outbox/replay-client";
import { observable } from "@trpc/server/observable";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { hasOutboxAdmissionFailed } from "@norish/shared/lib/trpc-errors";

const enqueue = vi.hoisted(() => vi.fn(async () => ({})));
const owner = vi.hoisted(() => vi.fn<() => string | null>(() => "u1"));

vi.mock("@/lib/outbox/outbox-store", () => ({ outboxStore: { enqueue } }));
vi.mock("@/lib/query-cache", () => ({
  cacheManager: { owner },
}));

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
  beforeEach(() => {
    enqueue.mockClear();
    owner.mockReturnValue("u1");
  });

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

  it("rejects admission when no cache owner has been established", async () => {
    owner.mockReturnValue(null);

    const result = await runLink(mutationOp(), errorWith(new TypeError("Failed to fetch")));

    expect(enqueue).not.toHaveBeenCalled();
    expect(hasOutboxAdmissionFailed(result.error)).toBe(true);
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

  it("waits for durable persistence before propagating the Queued signal", async () => {
    const order: string[] = [];
    let persist: (() => void) | undefined;

    enqueue.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          persist = () => {
            order.push("persisted");
            resolve({});
          };
        })
    );

    const pending = runLink(mutationOp(), errorWith(new TypeError("Failed to fetch"))).then(
      (result) => {
        order.push("errored");

        return result;
      }
    );

    // Give the link a chance to (incorrectly) propagate before persistence.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(order).toEqual([]);

    persist?.();
    const result = await pending;

    expect(order).toEqual(["persisted", "errored"]);
    expect(result.error).toBeInstanceOf(TypeError);
    expect(hasOutboxAdmissionFailed(result.error)).toBe(false);
  });

  it("marks the propagated error as a real failure when admission fails", async () => {
    enqueue.mockImplementationOnce(async () => {
      throw new Error("quota exceeded");
    });

    const result = await runLink(mutationOp(), errorWith(new TypeError("Failed to fetch")));

    expect(result.error).toBeInstanceOf(TypeError);
    expect(hasOutboxAdmissionFailed(result.error)).toBe(true);
  });

  it("encodes a FormData input for storage and reads its client-minted id", async () => {
    const formData = new FormData();

    formData.append("id", "33333333-3333-4333-8333-333333333333");
    formData.append("name", "Pasta");

    await runLink(
      mutationOp({ path: "recipes.create", input: formData }),
      errorWith(new TypeError("Failed to fetch"))
    );

    expect(enqueue).toHaveBeenCalledTimes(1);
    const stored = enqueue.mock.calls[0]?.[0] as { input: unknown; entityId: string | null };

    expect(isEncodedFormData(stored.input)).toBe(true);
    expect(stored.entityId).toBe("33333333-3333-4333-8333-333333333333");
  });
});
