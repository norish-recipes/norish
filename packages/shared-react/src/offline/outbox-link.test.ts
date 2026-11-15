import { observable } from "@trpc/server/observable";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { hasOutboxAdmissionFailed } from "@norish/shared/lib/trpc-errors";

import type { OutboxStore } from "./outbox-store";
import type { NewOutboxEntry, OutboxEntry } from "./outbox-types";
import { isEncodedFormData } from "./input-codec";
import { createOutboxLink } from "./outbox-link";
import { createOutboxStore } from "./outbox-store";
import { runReplayPass } from "./replay";
import { OUTBOX_REPLAY_HEADER } from "./replay-client";
import { createMemoryStorage } from "./testing/memory-storage";

const REPLAY_HEADER_VALUE = "test-outbox";

const enqueue = vi.fn(async (_entry: NewOutboxEntry) => ({}) as OutboxEntry);
const owner = vi.fn<() => string | null>(() => "u1");

type FakeOp = {
  type: "mutation" | "query";
  path: string;
  input: unknown;
  context: Record<string, unknown>;
};

function runLink(op: FakeOp, terminal: () => ReturnType<typeof observable>) {
  const link = createOutboxLink({
    store: { enqueue } as unknown as OutboxStore,
    owner,
    replayHeaderValue: REPLAY_HEADER_VALUE,
  })({} as never);

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
      context: { headers: { [OUTBOX_REPLAY_HEADER]: REPLAY_HEADER_VALUE } },
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
            resolve({} as OutboxEntry);
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
    const stored = enqueue.mock.calls[0]![0];

    expect(isEncodedFormData(stored.input)).toBe(true);
    expect(stored.entityId).toBe("33333333-3333-4333-8333-333333333333");
  });
});

describe("createOutboxLink: one entity's versioned edits", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  let store: OutboxStore;

  beforeEach(() => {
    store = createOutboxStore(createMemoryStorage().outbox);
  });

  const linkOver = (outbox: OutboxStore) =>
    createOutboxLink({ store: outbox, owner, replayHeaderValue: REPLAY_HEADER_VALUE })(
      {} as never
    );

  type Edit = { id: string; version: number; data: { name: string } };

  /** Applies an edit only at the version it holds, as `recipes.update` does. */
  function versionedServer(version: number) {
    const state = { version, names: [] as string[], sent: [] as number[] };
    const answer = (input: Edit) => {
      state.sent.push(input.version);
      if (input.version !== state.version) return { stale: true, version: null };
      state.version += 1;
      state.names.push(input.data.name);

      return { stale: false, version: state.version };
    };

    return { state, answer };
  }

  function send(
    link: ReturnType<typeof linkOver>,
    input: Edit,
    terminal: (op: FakeOp) => ReturnType<typeof observable>,
    context: Record<string, unknown> = {}
  ) {
    const op = { type: "mutation", path: "recipes.update", input, context };

    return new Promise<{ value?: unknown; error?: unknown }>((resolve) => {
      link({ op, next: terminal } as never).subscribe({
        next: (value: unknown) => resolve({ value }),
        error: (error: unknown) => resolve({ error }),
      });
    });
  }

  const answering =
    (server: ReturnType<typeof versionedServer>, gate?: Promise<void>) => (op: FakeOp) =>
      observable((observer) => {
        void (gate ?? Promise.resolve()).then(() => {
          observer.next({ result: { type: "data", data: server.answer(op.input as Edit) } });
          observer.complete();
        });
      });
  const edit = (name: string, version = 5, entity = id): Edit => ({
    id: entity,
    version,
    data: { name },
  });

  it("sends a second edit on the same base after the first's answer, at the version it stored", async () => {
    const server = versionedServer(5);
    const gate = Promise.withResolvers<void>();
    const link = linkOver(store);

    const first = send(link, edit("First"), answering(server, gate.promise));
    const second = send(link, edit("Second"), answering(server));

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(server.state.sent).toEqual([]);
    gate.resolve();
    await Promise.all([first, second]);

    expect(server.state).toMatchObject({ names: ["First", "Second"], sent: [5, 6] });
  });

  it("never moves an edit past another member's change", async () => {
    const server = versionedServer(5);
    const link = linkOver(store);

    server.state.version = 6;
    await send(link, edit("First"), answering(server));
    await send(link, edit("Second"), answering(server));

    expect(server.state).toMatchObject({ names: [], sent: [5, 5] });
  });

  it("does not hold an edit to another entity behind a pending one", async () => {
    const server = versionedServer(5);
    const link = linkOver(store);

    void send(link, edit("First"), answering(server, new Promise(() => {})));
    await send(
      link,
      edit("Other", 5, "22222222-2222-4222-8222-222222222222"),
      answering(versionedServer(5))
    );

    expect(server.state.sent).toEqual([]);
  });

  it("moves a queued edit of the entity to the stored version before the answer passes on", async () => {
    const server = versionedServer(5);
    const link = linkOver(store);

    await store.enqueue({
      id: "queued",
      ownerId: "u1",
      path: "recipes.update",
      input: edit("Queued"),
      entityId: id,
      operationId: null,
      headers: {},
    });
    await send(link, edit("First"), answering(server));

    expect((await store.loadAll()).map((entry) => entry.input)).toEqual([edit("Queued", 6)]);
  });

  it("lands both queued edits when the app dies between their replays", async () => {
    const server = versionedServer(5);
    const replayed = { skipOutboxCapture: true };

    for (const name of ["First", "Second"]) {
      await store.enqueue({
        id: name,
        ownerId: "u1",
        path: "recipes.update",
        input: edit(name),
        entityId: id,
        operationId: null,
        headers: {},
      });
    }
    const submitVia =
      (link: ReturnType<typeof linkOver>, reachable: () => boolean) => async (entry: OutboxEntry) => {
        const terminal = reachable()
          ? answering(server)
          : errorWith(new TypeError("Failed to fetch"));
        const { value, error } = await send(link, entry.input as Edit, terminal, replayed);

        return error ? { kind: "unreachable" as const } : { kind: "success" as const, value };
      };

    // The first replays, then the app is killed before the second is sent.
    let sends = 0;

    await runReplayPass({ store, ownerId: "u1", submit: submitVia(linkOver(store), () => sends++ === 0) });
    // A fresh start: nothing in memory, only the stored Outbox.
    await runReplayPass({ store, ownerId: "u1", submit: submitVia(linkOver(store), () => true) });

    expect(server.state.names).toEqual(["First", "Second"]);
  });
});
