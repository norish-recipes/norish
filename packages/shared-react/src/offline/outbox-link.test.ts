import { MutationObserver, QueryClient } from "@tanstack/react-query";
import { observable } from "@trpc/server/observable";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { hasOutboxAdmissionFailed, isQueuedOutboxSignal } from "@norish/shared/lib/trpc-errors";

import type { OutboxStore } from "./outbox-store";
import type { NewOutboxEntry, OutboxEntry } from "./outbox-types";
import { isEncodedFormData } from "./input-codec";
import { createOutboxLink, MUTATION_SEND_TIMEOUT_MS } from "./outbox-link";
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

  it("passes an excluded admin mutation's network failure through without storing its input", async () => {
    const failure = new TypeError("Failed to fetch");
    const result = await runLink(
      mutationOp({ path: "admin.testAIEndpoint", input: { apiKey: "sk-secret" } }),
      errorWith(failure)
    );

    expect(result.error).toBe(failure);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("excludes credentials and one-time secrets, not the procedures beside them", async () => {
    const failure = new TypeError("Failed to fetch");

    for (const path of [
      "caldav.saveConfig",
      "siteAuthTokens.create",
      "households.join",
      "user.apiKeys.create",
      "recipes.shareCreate",
    ]) {
      await runLink(mutationOp({ path, input: { id: "x" } }), errorWith(failure));
    }
    expect(enqueue).not.toHaveBeenCalled();

    await runLink(mutationOp({ path: "caldav.deleteConfig" }), errorWith(failure));
    await runLink(mutationOp({ path: "households.leave" }), errorWith(failure));
    await runLink(mutationOp({ path: "user.apiKeys.toggle" }), errorWith(failure));
    await runLink(mutationOp({ path: "recipes.shareRevoke" }), errorWith(failure));
    expect(enqueue).toHaveBeenCalledTimes(4);
  });

  it("excludes the admin share moderation, not the maker's own share writes", async () => {
    const failure = new TypeError("Failed to fetch");

    for (const path of [
      "recipes.shareRevokeAdmin",
      "recipes.shareReactivateAdmin",
      "recipes.shareDeleteAdmin",
    ]) {
      await runLink(mutationOp({ path, input: { id: "x" } }), errorWith(failure));
    }
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("excludes procedures of the admin router only", async () => {
    const failure = new TypeError("Failed to fetch");

    await runLink(mutationOp({ path: "administrators.x" }), errorWith(failure));
    await runLink(mutationOp({ path: "groceries.adminThing" }), errorWith(failure));
    await runLink(mutationOp({ path: "recipes.update", input: { id: "r1" } }), errorWith(failure));

    expect(enqueue).toHaveBeenCalledTimes(3);
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

describe("createOutboxLink: a whole edit waits behind its pending save", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const unreachable = () =>
    observable((observer) => observer.error(new TypeError("Failed to fetch")));
  let storage: ReturnType<typeof createMemoryStorage>;
  let store: OutboxStore;

  beforeEach(() => {
    storage = createMemoryStorage();
    store = createOutboxStore(storage.outbox);
    onConflict.mockClear();
    link = createOutboxLink({
      store,
      owner,
      replayHeaderValue: REPLAY_HEADER_VALUE,
      wholeEdits: new Set(["recipes.update"]),
      onConflict,
    })({} as never);
  });

  const answer = (data: unknown) => () =>
    observable((observer) => {
      observer.next({ result: { data } });
      observer.complete();
    });

  const onConflict = vi.fn();
  // One link per client, as the tRPC client builds it.
  let link: ReturnType<ReturnType<typeof createOutboxLink>>;

  function save(
    input: { id: string; version: number; data: { name: string } },
    terminal: () => ReturnType<typeof observable>,
    { path = "recipes.update", operationId = input.data.name, replay = false } = {}
  ) {
    const headers = {
      "x-operation-id": operationId,
      ...(replay ? { [OUTBOX_REPLAY_HEADER]: REPLAY_HEADER_VALUE } : {}),
    };
    const op = { id: ++opId, type: "mutation", path, input, context: { operationId, headers } };

    return new Promise<{ value?: unknown; error?: unknown }>((resolve) => {
      link({ op, next: terminal } as never).subscribe({
        next: (value: unknown) => resolve({ value }),
        error: (error: unknown) => resolve({ error }),
        complete: () => resolve({}),
      });
    });
  }

  const edit = (name: string, version = 3) => ({ id, version, data: { name } });
  let opId = 0;

  it("puts a second save in place of the unsent one, on the first's base", async () => {
    const terminal = vi.fn(unreachable);

    await save(edit("First", 3), terminal);
    const second = await save(edit("Second", 4), terminal);

    expect(terminal).toHaveBeenCalledTimes(1);
    expect(hasOutboxAdmissionFailed(second.error)).toBe(false);
    for (const entries of [await store.loadAll(), await storage.outbox.all()]) {
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        input: { id, version: 3, data: { name: "Second" } },
        operationId: "Second",
        headers: { "x-operation-id": "Second" },
        entityId: null,
      });
    }
    // A reload reads the one entry back.
    expect(await createOutboxStore(storage.outbox).forOwner("u1", "pending")).toHaveLength(1);
  });

  it("replays the one save, and it lands", async () => {
    await save(edit("First"), unreachable);
    await save(edit("Second"), unreachable);
    const submit = vi.fn(async (entry: OutboxEntry) => {
      expect(entry.input).toMatchObject({ version: 3, data: { name: "Second" } });

      return { kind: "success" as const };
    });

    const pass = await runReplayPass({ store, submit, ownerId: "u1" });

    expect(submit).toHaveBeenCalledTimes(1);
    expect(pass).toMatchObject({ removed: 1, parked: 0 });
    expect(await store.loadAll()).toEqual([]);
  });

  it("queues a save as its own entry behind one already attempted", async () => {
    await save(edit("First"), unreachable);
    const [first] = await store.loadAll();

    await store.update(first!.seq, { attempts: 1 });
    await save(edit("Second", 3), unreachable);

    expect((await store.loadAll()).map((entry) => entry.input)).toEqual([
      edit("First"),
      edit("Second"),
    ]);
  });

  it.each([
    ["in the order sent", [0, 1], ["First", "Second"]],
    ["the later one first", [1, 0], ["Second", "First"]],
  ])("stores each of two live saves that both fail, %s", async (_order, failOrder, stored) => {
    const fails: (() => void)[] = [];
    const inFlight = () =>
      observable((observer) => {
        fails.push(() => observer.error(new TypeError("Failed to fetch")));
      });
    const saves = [save(edit("First"), inFlight), save(edit("Second"), inFlight)];

    await new Promise((resolve) => setTimeout(resolve, 0));
    for (const index of failOrder) {
      fails[index]!();
      await saves[index];
    }

    expect((await store.loadAll()).map((entry) => entry.operationId)).toEqual(stored);
  });

  it("stores a save that fails unanswered after a later one was refused", async () => {
    let fail = () => {};
    const inFlight = () =>
      observable((observer) => {
        fail = () => observer.error(new TypeError("Failed to fetch"));
      });
    const first = save(edit("First"), inFlight);

    await new Promise((resolve) => setTimeout(resolve, 0));
    await save(edit("Second"), errorWith({ data: { httpStatus: 400 } }));
    fail();
    await first;

    expect(await store.loadAll()).toMatchObject([
      { input: edit("First"), operationId: "First", status: "pending" },
    ]);
  });

  it("never puts a failed save in place of another entry", async () => {
    let fail = () => {};
    const inFlight = () =>
      observable((observer) => {
        fail = () => observer.error(new TypeError("Failed to fetch"));
      });
    const mine = save(edit("Mine"), inFlight);

    await new Promise((resolve) => setTimeout(resolve, 0));
    // Another tab queues a newer save of the recipe meanwhile.
    await store.enqueue({
      id: "other",
      ownerId: "u1",
      path: "recipes.update",
      input: edit("Other tab"),
      entityId: null,
      operationId: "Other tab",
      headers: {},
    });
    fail();
    await mine;

    expect((await store.loadAll()).map((entry) => entry.operationId)).toEqual([
      "Other tab",
      "Mine",
    ]);
  });

  it("sends a save live when nothing of that recipe is pending", async () => {
    const terminal = vi.fn(answer({ stale: false, version: 4 }));

    await save({ ...edit("Other"), id: "22222222-2222-4222-8222-222222222222" }, unreachable);
    const result = await save(edit("Live"), terminal);

    expect(terminal).toHaveBeenCalledTimes(1);
    expect(result.value).toEqual({ result: { data: { stale: false, version: 4 } } });
  });

  it.each(["cookbooks.update", "recipes.shareUpdate"])(
    "leaves %s with a top-level { id, version } as it was",
    async (path) => {
      const terminal = vi.fn(unreachable);

      await save(edit("First"), terminal, { path });
      await save(edit("Second"), terminal, { path });

      expect(terminal).toHaveBeenCalledTimes(2);
      expect(await store.loadAll()).toMatchObject([
        { path, input: edit("First"), entityId: id },
        { path, input: edit("Second"), entityId: id },
      ]);
    }
  );

  it("stores nothing for a live save the server refused, and reports it", async () => {
    const result = await save(edit("Mine"), answer({ stale: true, version: null }));

    expect(result.value).toEqual({ result: { data: { stale: true, version: null } } });
    expect(await store.loadAll()).toEqual([]);
    expect(onConflict).toHaveBeenCalledTimes(1);
  });

  it("leaves a replayed refusal and a stored save to Replay", async () => {
    await save(edit("Replayed"), answer({ stale: true, version: null }), { replay: true });
    await save(edit("Stored"), answer({ stale: false, version: 4 }));

    expect(await store.loadAll()).toEqual([]);
    expect(onConflict).not.toHaveBeenCalled();
  });

  it("still sends a favourite queued behind a refused edit of its recipe", async () => {
    await save(edit("Mine"), unreachable);
    await new Promise<void>((resolve) =>
      createOutboxLink({ store, owner, replayHeaderValue: REPLAY_HEADER_VALUE })({} as never)({
        op: {
          type: "mutation",
          path: "favorites.toggle",
          input: { recipeId: id, isFavorite: true },
          context: {},
        },
        next: unreachable,
      } as never).subscribe({ error: () => resolve() })
    );
    const submit = vi.fn(async (entry: OutboxEntry) => ({
      kind: entry.path === "recipes.update" ? ("conflict" as const) : ("success" as const),
    }));

    const pass = await runReplayPass({ store, submit, ownerId: "u1" });

    expect(submit.mock.calls.map(([entry]) => entry.path)).toEqual([
      "recipes.update",
      "favorites.toggle",
    ]);
    expect(pass).toMatchObject({ removed: 1, parked: 1 });
  });
});

describe("createOutboxLink: a send with no answer", () => {
  beforeEach(() => {
    enqueue.mockClear();
    owner.mockReturnValue("u1");
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  const timedLink = () =>
    createOutboxLink({
      store: { enqueue } as unknown as OutboxStore,
      owner,
      replayHeaderValue: REPLAY_HEADER_VALUE,
      timedWrites: new Set(["groceries.toggle"]),
    })({} as never);
  const toggle = (overrides: Partial<FakeOp> = {}) =>
    mutationOp({ path: "groceries.toggle", input: { groceries: [{ id: "g1" }] }, ...overrides });

  /** A send that answers only when the test says, and records whether it was aborted. */
  const hung = () => {
    const send = { answer: (_value: unknown) => {}, aborted: false };
    const terminal = () =>
      observable((observer) => {
        send.answer = (value) => observer.next(value);

        return () => {
          send.aborted = true;
        };
      });

    return { send, terminal };
  };

  function run(op: FakeOp, terminal: () => ReturnType<typeof observable>) {
    const seen: unknown[] = [];

    timedLink()({ op, next: terminal } as never).subscribe({
      next: (value: unknown) => seen.push(value),
      error: (error: unknown) => seen.push(error),
    });

    return seen;
  }

  it("aborts and queues an opted-in write with its operation id once the timeout passes", async () => {
    const { send, terminal } = hung();
    const seen = run(toggle(), terminal);

    await vi.advanceTimersByTimeAsync(MUTATION_SEND_TIMEOUT_MS);

    expect(isQueuedOutboxSignal(seen[0])).toBe(true);
    expect(send.aborted).toBe(true);
    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ path: "groceries.toggle", operationId: "op-1" })
    );
  });

  it("delivers nothing of the aborted request's late answer", async () => {
    const { send, terminal } = hung();
    const seen = run(toggle(), terminal);

    await vi.advanceTimersByTimeAsync(MUTATION_SEND_TIMEOUT_MS);
    send.answer({ result: { data: { ok: true } } });

    expect(seen).toHaveLength(1);
    expect(isQueuedOutboxSignal(seen[0])).toBe(true);
  });

  it("leaves a send that answers in time alone", async () => {
    const { send, terminal } = hung();
    const seen = run(toggle(), terminal);

    await vi.advanceTimersByTimeAsync(MUTATION_SEND_TIMEOUT_MS - 1);
    send.answer({ ok: true });
    await vi.advanceTimersByTimeAsync(MUTATION_SEND_TIMEOUT_MS);

    expect(seen).toEqual([{ ok: true }]);
    expect(send.aborted).toBe(false);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("sends the next grocery write once the toggle ahead is queued", async () => {
    const link = timedLink();
    const first = hung();
    const sent: string[] = [];
    const send = (op: FakeOp, terminal: () => ReturnType<typeof observable>) => () =>
      new Promise((resolve, reject) => {
        sent.push(op.context.operationId as string);
        link({ op, next: terminal } as never).subscribe({ next: resolve, error: reject });
      });
    const client = new QueryClient();
    const write = (fn: () => Promise<unknown>) =>
      new MutationObserver(client, { mutationFn: fn, scope: { id: "grocery-writes" } })
        .mutate()
        .catch(() => undefined);

    void write(send(toggle(), first.terminal));
    void write(send(toggle({ context: { operationId: "op-2" } }), succeedWith({ ok: true })));
    await vi.advanceTimersByTimeAsync(0);
    expect(sent).toEqual(["op-1"]);

    await vi.advanceTimersByTimeAsync(MUTATION_SEND_TIMEOUT_MS);

    expect(sent).toEqual(["op-1", "op-2"]);
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["admin.testAIEndpoint", { provider: "ollama", apiKey: "secret" }],
    ["recipes.update", { id: "r1", version: 1, data: { name: "Slow" } }],
    ["groceries.create", { id: "g1", name: "Milk" }],
  ])("puts no timer on %s, which is not opted in", async (path, input) => {
    const { send, terminal } = hung();
    const seen = run(mutationOp({ path, input }), terminal);

    await vi.advanceTimersByTimeAsync(MUTATION_SEND_TIMEOUT_MS * 10);
    send.answer({ ok: true });

    expect(seen).toEqual([{ ok: true }]);
    expect(send.aborted).toBe(false);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("times out a replayed opted-in write, and only that", async () => {
    const replay = { headers: { [OUTBOX_REPLAY_HEADER]: REPLAY_HEADER_VALUE } };
    const timed = hung();
    const untimed = hung();
    const timedSeen = run(toggle({ context: replay }), timed.terminal);
    const untimedSeen = run(
      mutationOp({ path: "recipes.delete", context: replay }),
      untimed.terminal
    );

    await vi.advanceTimersByTimeAsync(MUTATION_SEND_TIMEOUT_MS * 10);

    expect(timed.send.aborted).toBe(true);
    expect(isQueuedOutboxSignal(timedSeen[0])).toBe(true);
    expect(untimed.send.aborted).toBe(false);
    expect(untimedSeen).toEqual([]);
    expect(enqueue).not.toHaveBeenCalled();
  });
});
