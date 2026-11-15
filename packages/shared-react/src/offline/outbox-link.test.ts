import { observable } from "@trpc/server/observable";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { hasOutboxAdmissionFailed } from "@norish/shared/lib/trpc-errors";

import type { OutboxStore } from "./outbox-store";
import type { NewOutboxEntry, OutboxEntry } from "./outbox-types";
import { isEncodedFormData } from "./input-codec";
import { createProcessLock, runWithOutboxLock } from "./leader";
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

describe("createOutboxLink: a whole edit waits behind its pending save", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const unreachable = () =>
    observable((observer) => observer.error(new TypeError("Failed to fetch")));
  let storage: ReturnType<typeof createMemoryStorage>;
  let store: OutboxStore;
  let lock: ReturnType<typeof createProcessLock>;

  beforeEach(() => {
    storage = createMemoryStorage();
    store = createOutboxStore(storage.outbox);
    lock = createProcessLock();
    onConflict.mockClear();
  });

  const answer = (data: unknown) => () =>
    observable((observer) => {
      observer.next({ result: { data } });
      observer.complete();
    });

  const link = createOutboxLinkOver();

  const onConflict = vi.fn();

  function createOutboxLinkOver() {
    return () =>
      createOutboxLink({
        store,
        owner,
        replayHeaderValue: REPLAY_HEADER_VALUE,
        wholeEdits: new Set(["recipes.update"]),
        locks: () => lock,
        onConflict,
      })({} as never);
  }

  function save(
    input: { id: string; version: number; data: { name: string } },
    terminal: () => ReturnType<typeof observable>,
    { path = "recipes.update", operationId = input.data.name, replay = false } = {}
  ) {
    const headers = {
      "x-operation-id": operationId,
      ...(replay ? { [OUTBOX_REPLAY_HEADER]: REPLAY_HEADER_VALUE } : {}),
    };
    const op = { type: "mutation", path, input, context: { operationId, headers } };

    return new Promise<{ value?: unknown; error?: unknown }>((resolve) => {
      link()({ op, next: terminal } as never).subscribe({
        next: (value: unknown) => resolve({ value }),
        error: (error: unknown) => resolve({ error }),
        complete: () => resolve({}),
      });
    });
  }

  const edit = (name: string, version = 3) => ({ id, version, data: { name } });

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

  it("does not touch the entry while Replay holds the Outbox", async () => {
    await save(edit("First"), unreachable);
    let release = () => {};
    const replaying = runWithOutboxLock(
      () => new Promise<void>((resolve) => (release = resolve)),
      lock
    );

    const second = save(edit("Second"), unreachable);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect((await store.loadAll())[0]!.input).toEqual(edit("First"));
    release();
    await replaying;
    await second;
    expect((await store.loadAll())[0]!.input).toEqual(edit("Second"));
  });

  it("sends a save live when nothing of that recipe is pending", async () => {
    const terminal = vi.fn(answer({ stale: false, version: 4 }));

    await save({ ...edit("Other"), id: "22222222-2222-4222-8222-222222222222" }, unreachable);
    const result = await save(edit("Live"), terminal);

    expect(terminal).toHaveBeenCalledTimes(1);
    expect(result.value).toEqual({ result: { data: { stale: false, version: 4 } } });
  });

  it.each(["siteAuthTokens.update", "recipes.shareUpdate"])(
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

  it("parks a live save the server refused as Conflicted, and reports it", async () => {
    const result = await save(edit("Mine"), answer({ stale: true, version: null }));

    expect(result.value).toEqual({ result: { data: { stale: true, version: null } } });
    expect(await store.loadAll()).toMatchObject([
      { path: "recipes.update", input: edit("Mine"), status: "conflicted", entityId: null },
    ]);
    expect(onConflict).toHaveBeenCalledWith(
      expect.objectContaining({ input: edit("Mine"), status: "conflicted" })
    );
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
