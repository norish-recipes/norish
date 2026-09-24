// @vitest-environment node
import { isTrackedEnvelope, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import type { RealtimeLaggedError as RealtimeLaggedErrorType } from "@norish/shared-server/realtime/hub";
import type { RealtimeEventEnvelope } from "@norish/shared/contracts/realtime/envelope";
import { defineRealtimeCatalogue } from "@norish/shared/contracts/realtime/catalogue";

import { createMockAuthedContext, createMockCallerContext } from "./calendar/test-utils";

/* ------------------------------------------------------------------ fakes */

/** One live channel on the fake hub: push events, fail it, or let abort end it. */
class FakeLiveSource implements AsyncIterable<RealtimeEventEnvelope> {
  private readonly queue: RealtimeEventEnvelope[] = [];
  private error: Error | null = null;
  private done = false;
  private wake: (() => void) | null = null;
  readonly returned = vi.fn();

  constructor(
    readonly channel: string,
    readonly maxQueue: number | undefined,
    signal: AbortSignal | undefined
  ) {
    signal?.addEventListener("abort", () => this.end(), { once: true });
  }

  push(envelope: RealtimeEventEnvelope) {
    this.queue.push(envelope);
    this.notify();
  }

  fail(error: Error) {
    this.error = error;
    this.notify();
  }

  end() {
    this.done = true;
    this.notify();
  }

  private notify() {
    const wake = this.wake;

    this.wake = null;
    wake?.();
  }

  [Symbol.asyncIterator](): AsyncIterator<RealtimeEventEnvelope> {
    return {
      next: async () => {
        for (;;) {
          const value = this.queue.shift();

          if (value) return { value, done: false };
          if (this.error) {
            const error = this.error;

            this.error = null;
            throw error;
          }
          if (this.done) return { value: undefined, done: true };

          await new Promise<void>((resolve) => {
            this.wake = resolve;
          });
        }
      },
      return: async () => {
        this.returned();
        this.done = true;

        return { value: undefined, done: true };
      },
    };
  }
}

const hub = vi.hoisted(() => ({
  sources: new Map<string, FakeLiveSourceLike>(),
  subscribe: vi.fn(),
}));

type FakeLiveSourceLike = {
  push: (envelope: RealtimeEventEnvelope) => void;
  fail: (error: Error) => void;
  end: () => void;
  returned: ReturnType<typeof vi.fn>;
};

type StreamEntry = [id: string, fields: string[]];

const redis = vi.hoisted(() => {
  const streams = new Map<string, StreamEntry[]>();

  const compare = (a: string, b: string) => {
    const [ams, aseq] = a.split("-").map(Number) as [number, number];
    const [bms, bseq] = b.split("-").map(Number) as [number, number];

    return ams === bms ? aseq - bseq : ams - bms;
  };

  return {
    streams,
    xrevrange: vi.fn(
      async (key: string, _end: string, _start: string, _c: string, count: number) => {
        const entries = streams.get(key) ?? [];

        return [...entries].reverse().slice(0, count);
      }
    ),
    xrange: vi.fn(async (key: string, start: string, _end: string, _c: string, count: number) => {
      const entries = streams.get(key);

      if (!entries) return [];

      const filtered =
        start === "-"
          ? entries
          : entries.filter(([id]) =>
              start.startsWith("(") ? compare(id, start.slice(1)) > 0 : compare(id, start) >= 0
            );

      return filtered.slice(0, count);
    }),
  };
});

const logged = vi.hoisted(() => ({
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  trace: vi.fn(),
}));

vi.mock("@norish/shared-server/realtime/hub", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@norish/shared-server/realtime/hub")>()),
  getRealtimeHub: () => ({ subscribe: hub.subscribe, on: vi.fn(), stats: vi.fn() }),
}));
vi.mock("@norish/shared-server/redis/client", () => ({
  getPublisherClient: vi.fn(async () => redis),
}));
vi.mock("@norish/shared-server/logger", () => ({
  trpcLogger: logged,
  createLogger: () => logged,
}));
vi.mock("@norish/db", () => ({ isUserServerAdmin: vi.fn() }));
vi.mock("@norish/db/repositories/recipe-shares", () => ({ getActiveRecipeShareByToken: vi.fn() }));
vi.mock("@norish/db/repositories/recipes", () => ({ getRecipeFull: vi.fn() }));
vi.mock("@norish/shared-server/cache/household", () => ({ getCachedHouseholdForUser: vi.fn() }));
const { RealtimeLaggedError } = await import("@norish/shared-server/realtime/hub");
const { defineRealtimeDomain } = await import("@norish/shared-server/realtime/domain");
const { encodeCursor, identityHashFor, RESUME_TTL_SECONDS } =
  await import("@norish/shared-server/realtime/resume");
const { createCallerFactory, router } = await import("../src/trpc");
const { realtimeSubscription } = await import("../src/realtime-subscription");

/* -------------------------------------------------------------- fixtures */

const catalogue = defineRealtimeCatalogue("grocery", {
  created: { scope: "household", payload: z.object({ ids: z.array(z.string()) }) },
  failed: { scope: "user", payload: z.object({ reason: z.string() }) },
  imported: { scope: "policy", payload: z.object({ recipeId: z.string() }) },
  becameUsable: { scope: "internal", payload: z.object({ recipeId: z.string() }) },
});

const domain = defineRealtimeDomain(catalogue);

const testRouter = router({
  onCreated: realtimeSubscription(domain, "created"),
  onFailed: realtimeSubscription(domain, "failed"),
  onImported: realtimeSubscription(domain, "imported", { maxQueue: 7 }),
  // @ts-expect-error an `internal` event is not subscribable
  onBecameUsable: realtimeSubscription(domain, "becameUsable"),
});

const HOUSEHOLD = "test-household-id";
const USER = "test-user-id";
const CREATED = `norish:grocery:household:${HOUSEHOLD}:created`;
const CREATED_STREAM = `norish:stream:grocery:household:${HOUSEHOLD}:created`;
const IMPORTED = {
  household: `norish:grocery:household:${HOUSEHOLD}:imported`,
  broadcast: "norish:grocery:broadcast:imported",
  user: `norish:grocery:user:${USER}:imported`,
};
const identity = { userId: USER, householdKey: HOUSEHOLD };
const hash = identityHashFor(identity);

/** Stream ids must be younger than the TTL, so they are minted from now. */
const base = Date.now() - 60_000;
const id = (offsetMs: number, seq = 0) => `${base + offsetMs}-${seq}`;

function envelope(channel: string, eventId: string, payload: unknown): RealtimeEventEnvelope {
  const parts = channel.split(":");
  const scope = parts[2] as RealtimeEventEnvelope["meta"]["scope"];

  return {
    meta: {
      version: 1,
      eventId,
      eventName: parts.at(-1)!,
      namespace: parts[1]!,
      scope,
      channel,
      occurredAt: "2024-01-01T00:00:00.000Z",
    },
    payload,
  };
}

function seedStream(channel: string, entries: Array<[id: string, payload: unknown]>) {
  const key = `norish:stream:${channel.slice("norish:".length)}`;

  redis.streams.set(
    key,
    entries.map(([entryId, payload]) => [
      entryId,
      ["e", superjson.stringify(envelope(channel, "$ID$", payload))],
    ])
  );
}

type Yielded = { cursor: string; data: unknown };

async function take(iterator: AsyncIterator<unknown>): Promise<Yielded> {
  const { value, done } = await iterator.next();

  expect(done).toBe(false);
  expect(isTrackedEnvelope(value)).toBe(true);

  const [cursor, data] = value as [string, unknown];

  return { cursor, data };
}

async function subscribe<K extends "onCreated" | "onFailed" | "onImported" | "onBecameUsable">(
  procedure: K,
  input?: { lastEventId?: string | null },
  ctx = createMockAuthedContext()
) {
  const controller = new AbortController();
  const caller = createCallerFactory(testRouter)(createMockCallerContext(ctx), {
    signal: controller.signal,
  });
  const call = caller[procedure] as (input?: unknown) => Promise<unknown>;
  const stream = (await call(input)) as AsyncIterable<unknown>;

  return { iterator: stream[Symbol.asyncIterator](), controller };
}

async function failure(promise: Promise<unknown>): Promise<TRPCError> {
  let caught: unknown;

  try {
    await promise;
  } catch (err) {
    caught = err;
  }

  expect(caught).toBeInstanceOf(TRPCError);

  return caught as TRPCError;
}

function laggedCause(error: TRPCError): RealtimeLaggedErrorType {
  expect(error.code).toBe("PRECONDITION_FAILED");
  expect(error.message).toBe("REALTIME_LAGGED");
  expect(error.cause).toBeInstanceOf(RealtimeLaggedError);

  return error.cause as RealtimeLaggedErrorType;
}

beforeEach(() => {
  vi.clearAllMocks();
  redis.streams.clear();
  hub.sources.clear();
  hub.subscribe.mockImplementation(
    (channel: string, opts: { signal?: AbortSignal; maxQueue?: number } = {}) => {
      const source = new FakeLiveSource(channel, opts.maxQueue, opts.signal);

      hub.sources.set(channel, source);

      return source;
    }
  );
});

/* ----------------------------------------------------------------- tests */

describe("channel selection", () => {
  it("subscribes a household event on the household channel", async () => {
    const { iterator, controller } = await subscribe("onCreated");

    await take(iterator);
    expect([...hub.sources.keys()]).toEqual([CREATED]);
    controller.abort();
  });

  it("subscribes a user event on the user channel", async () => {
    const { iterator, controller } = await subscribe("onFailed");

    await take(iterator);
    expect([...hub.sources.keys()]).toEqual([`norish:grocery:user:${USER}:failed`]);
    controller.abort();
  });

  it("subscribes a policy event on household, broadcast and user, with the maxQueue option", async () => {
    const { iterator, controller } = await subscribe("onImported");

    await take(iterator);
    expect([...hub.sources.keys()]).toEqual([
      IMPORTED.household,
      IMPORTED.broadcast,
      IMPORTED.user,
    ]);
    expect(hub.subscribe).toHaveBeenCalledWith(
      IMPORTED.household,
      expect.objectContaining({ maxQueue: 7 })
    );
    controller.abort();
  });

  it("uses the user id as household key for a household-less user", async () => {
    const ctx = createMockAuthedContext(undefined, null);
    const { iterator, controller } = await subscribe("onCreated", undefined, ctx);

    await take(iterator);
    expect(ctx.householdKey).toBe(USER);
    expect([...hub.sources.keys()]).toEqual([`norish:grocery:household:${USER}:created`]);
    controller.abort();
  });

  it("refuses an internal event at runtime as well as at the type level", async () => {
    const { iterator } = await subscribe("onBecameUsable");

    await expect(iterator.next()).rejects.toThrow(/not subscribable/);
  });
});

describe("fresh subscription", () => {
  it("yields a Cursor Mark first whose cursor holds each channel's last stream id", async () => {
    seedStream(IMPORTED.household, [
      [id(1), { recipeId: "a" }],
      [id(2), { recipeId: "b" }],
    ]);
    seedStream(IMPORTED.user, [[id(3), { recipeId: "c" }]]);

    const { iterator, controller } = await subscribe("onImported");
    const first = await take(iterator);

    expect(first.data).toEqual({ mark: "cursor" });
    expect(first.cursor).toBe(encodeCursor({ identityHash: hash, ids: [id(2), "0-0", id(3)] }));
    expect(redis.xrevrange).toHaveBeenCalledTimes(3);
    expect(redis.xrange).not.toHaveBeenCalled();
    controller.abort();
  });

  it("registers the live listeners before it reads the stream", async () => {
    const order: string[] = [];

    hub.subscribe.mockImplementation((channel: string, opts: { signal?: AbortSignal }) => {
      order.push("listen");

      return new FakeLiveSource(channel, undefined, opts.signal);
    });
    redis.xrevrange.mockImplementationOnce(async () => {
      order.push("read");

      return [];
    });

    const { iterator, controller } = await subscribe("onCreated");

    await take(iterator);
    expect(order).toEqual(["listen", "read"]);
    controller.abort();
  });

  it("yields live envelopes with an advanced cursor and validated payloads", async () => {
    const { iterator, controller } = await subscribe("onCreated");

    await take(iterator);
    hub.sources.get(CREATED)!.push(envelope(CREATED, id(10), { ids: ["g-1"], extra: 1 }));

    const live = await take(iterator);

    expect(live.data).toEqual({
      meta: expect.objectContaining({ eventId: id(10), channel: CREATED }),
      payload: { ids: ["g-1"] },
    });
    expect(live.cursor).toBe(encodeCursor({ identityHash: hash, ids: [id(10)] }));
    controller.abort();
  });

  it("drops a live event that fails its schema with a warn and keeps going", async () => {
    const { iterator, controller } = await subscribe("onCreated");

    await take(iterator);
    hub.sources.get(CREATED)!.push(envelope(CREATED, id(10), { ids: "nope" }));
    hub.sources.get(CREATED)!.push(envelope(CREATED, id(11), { ids: ["g-2"] }));

    const live = await take(iterator);

    expect((live.data as RealtimeEventEnvelope).meta.eventId).toBe(id(11));
    expect(logged.warn).toHaveBeenCalledWith(
      expect.objectContaining({ channel: CREATED }),
      "Dropped realtime event failing its schema"
    );
    controller.abort();
  });

  it("ends with PRECONDITION_FAILED / REALTIME_LAGGED when the hub overflows", async () => {
    const { iterator, controller } = await subscribe("onCreated");

    await take(iterator);
    hub.sources.get(CREATED)!.fail(new RealtimeLaggedError(CREATED, "queue-overflow", 101));

    const cause = laggedCause(await failure(iterator.next()));

    expect(cause).toMatchObject({ reason: "queue-overflow", dropped: 101 });
    expect(logged.warn).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER, event: "created", reason: "queue-overflow" }),
      "Realtime subscription lagged"
    );
    controller.abort();
  });

  it("ends once, with no unhandled rejection, when every channel lags at the same moment", async () => {
    const { iterator, controller } = await subscribe("onImported");

    await take(iterator);
    const pending = iterator.next();

    for (const [channel, source] of hub.sources) {
      source.fail(new RealtimeLaggedError(channel, "redis-reconnect", 0));
    }

    const cause = laggedCause(await failure(pending));

    expect(cause.reason).toBe("redis-reconnect");
    for (const source of hub.sources.values()) {
      expect(source.returned).toHaveBeenCalled();
    }
    await expect(iterator.next()).resolves.toEqual({ value: undefined, done: true });
    controller.abort();
  });

  it("ends cleanly on abort and returns every live iterable", async () => {
    const { iterator, controller } = await subscribe("onImported");

    await take(iterator);
    const pending = iterator.next();

    controller.abort();

    await expect(pending).resolves.toEqual({ value: undefined, done: true });
    for (const source of hub.sources.values()) {
      expect(source.returned).toHaveBeenCalled();
    }
  });
});

describe("resume", () => {
  it("replays the entries after the cursor in order, with eventId set to their ids, then live", async () => {
    seedStream(CREATED, [
      [id(1), { ids: ["g-1"] }],
      [id(2), { ids: ["g-2"] }],
      [id(3), { ids: ["g-3"] }],
    ]);

    const lastEventId = encodeCursor({ identityHash: hash, ids: [id(1)] });
    const { iterator, controller } = await subscribe("onCreated", { lastEventId });

    const mark = await take(iterator);

    expect(mark.data).toEqual({ mark: "cursor" });
    expect(mark.cursor).toBe(lastEventId);

    const second = await take(iterator);
    const third = await take(iterator);

    expect((second.data as RealtimeEventEnvelope).meta.eventId).toBe(id(2));
    expect((second.data as RealtimeEventEnvelope).payload).toEqual({ ids: ["g-2"] });
    expect(second.cursor).toBe(encodeCursor({ identityHash: hash, ids: [id(2)] }));
    expect((third.data as RealtimeEventEnvelope).meta.eventId).toBe(id(3));
    expect(third.cursor).toBe(encodeCursor({ identityHash: hash, ids: [id(3)] }));

    expect(redis.xrange).toHaveBeenCalledWith(CREATED_STREAM, `(${id(1)}`, "+", "COUNT", 1000);
    expect(redis.xrevrange).not.toHaveBeenCalled();

    hub.sources.get(CREATED)!.push(envelope(CREATED, id(4), { ids: ["g-4"] }));

    const live = await take(iterator);

    expect((live.data as RealtimeEventEnvelope).meta.eventId).toBe(id(4));
    expect(live.cursor).toBe(encodeCursor({ identityHash: hash, ids: [id(4)] }));
    controller.abort();
  });

  it("yields a live envelope whose id equals a replayed entry's exactly once", async () => {
    seedStream(CREATED, [
      [id(1), { ids: ["g-1"] }],
      [id(2), { ids: ["g-2"] }],
    ]);

    const { iterator, controller } = await subscribe("onCreated", {
      lastEventId: encodeCursor({ identityHash: hash, ids: [id(1)] }),
    });

    await take(iterator);
    // The live copy arrives while the replay is still being read.
    hub.sources.get(CREATED)!.push(envelope(CREATED, id(2), { ids: ["g-2"] }));
    hub.sources.get(CREATED)!.push(envelope(CREATED, id(3), { ids: ["g-3"] }));

    const replayed = await take(iterator);
    const next = await take(iterator);

    expect((replayed.data as RealtimeEventEnvelope).meta.eventId).toBe(id(2));
    expect((next.data as RealtimeEventEnvelope).meta.eventId).toBe(id(3));
    controller.abort();
  });

  it("merges three channels' replays by id for a policy subscription", async () => {
    seedStream(IMPORTED.household, [
      [id(1), { recipeId: "h1" }],
      [id(5), { recipeId: "h5" }],
    ]);
    seedStream(IMPORTED.broadcast, [
      [id(2), { recipeId: "b2" }],
      [id(6), { recipeId: "b6" }],
    ]);
    seedStream(IMPORTED.user, [[id(4), { recipeId: "u4" }]]);

    const { iterator, controller } = await subscribe("onImported", {
      lastEventId: encodeCursor({ identityHash: hash, ids: [id(1), id(2), "0-0"] }),
    });

    await take(iterator);

    const got: Array<{ recipeId: string; cursor: string }> = [];

    for (let i = 0; i < 2; i++) {
      const item = await take(iterator);

      got.push({
        recipeId: (item.data as RealtimeEventEnvelope<{ recipeId: string }>).payload.recipeId,
        cursor: item.cursor,
      });
    }

    expect(got.map((g) => g.recipeId)).toEqual(["h5", "b6"]);
    expect(got[0]!.cursor).toBe(encodeCursor({ identityHash: hash, ids: [id(5), id(2), "0-0"] }));
    expect(got[1]!.cursor).toBe(encodeCursor({ identityHash: hash, ids: [id(5), id(6), "0-0"] }));
    // The user channel's cursor was 0-0: nothing seen, nothing to replay.
    expect(redis.xrange).not.toHaveBeenCalledWith(
      `norish:stream:grocery:user:${USER}:imported`,
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything()
    );
    controller.abort();
  });

  it("continues when the stream key is missing and the cursor is younger than the TTL", async () => {
    const { iterator, controller } = await subscribe("onCreated", {
      lastEventId: encodeCursor({ identityHash: hash, ids: [id(1)] }),
    });

    await take(iterator);
    hub.sources.get(CREATED)!.push(envelope(CREATED, id(9), { ids: ["g-9"] }));

    const live = await take(iterator);

    expect((live.data as RealtimeEventEnvelope).meta.eventId).toBe(id(9));
    controller.abort();
  });

  it("is Lagged cursor-trimmed when the stream's first id is past the cursor", async () => {
    seedStream(CREATED, [
      [id(5), { ids: ["g-5"] }],
      [id(6), { ids: ["g-6"] }],
    ]);

    const { iterator, controller } = await subscribe("onCreated", {
      lastEventId: encodeCursor({ identityHash: hash, ids: [id(1)] }),
    });

    await take(iterator);

    const cause = laggedCause(await failure(iterator.next()));

    expect(cause).toMatchObject({ channel: CREATED, reason: "cursor-trimmed" });
    expect(redis.xrange).toHaveBeenCalledTimes(1);
    controller.abort();
  });

  it("is Lagged cursor-expired without a Redis call when the cursor is older than the TTL", async () => {
    const stale = `${Date.now() - RESUME_TTL_SECONDS * 1_000 - 5_000}-0`;
    const { iterator, controller } = await subscribe("onCreated", {
      lastEventId: encodeCursor({ identityHash: hash, ids: [stale] }),
    });

    const cause = laggedCause(await failure(iterator.next()));

    expect(cause.reason).toBe("cursor-expired");
    expect(redis.xrange).not.toHaveBeenCalled();
    expect(redis.xrevrange).not.toHaveBeenCalled();
    controller.abort();
  });

  it("is Lagged cursor-invalid for a malformed cursor", async () => {
    const { iterator, controller } = await subscribe("onCreated", { lastEventId: "what" });

    const cause = laggedCause(await failure(iterator.next()));

    expect(cause.reason).toBe("cursor-invalid");
    expect(redis.xrange).not.toHaveBeenCalled();
    controller.abort();
  });

  it("is Lagged identity-changed for a cursor from another household and never reads its stream", async () => {
    const other = createMockAuthedContext(undefined, {
      ...createMockAuthedContext().household!,
      id: "household-a",
    });
    const cursorFromA = encodeCursor({
      identityHash: identityHashFor({ userId: USER, householdKey: "household-a" }),
      ids: [id(1)],
    });

    seedStream("norish:grocery:household:household-a:created", [[id(2), { ids: ["a"] }]]);

    expect(other.householdKey).toBe("household-a");

    const { iterator, controller } = await subscribe("onCreated", { lastEventId: cursorFromA });

    const cause = laggedCause(await failure(iterator.next()));

    expect(cause.reason).toBe("identity-changed");
    expect(redis.xrange).not.toHaveBeenCalled();
    expect(redis.xrevrange).not.toHaveBeenCalled();
    controller.abort();
  });

  it("is Lagged identity-changed when the channel count does not match the current scope", async () => {
    const { iterator, controller } = await subscribe("onImported", {
      lastEventId: encodeCursor({ identityHash: hash, ids: [id(1)] }),
    });

    const cause = laggedCause(await failure(iterator.next()));

    expect(cause.reason).toBe("identity-changed");
    controller.abort();
  });
});
