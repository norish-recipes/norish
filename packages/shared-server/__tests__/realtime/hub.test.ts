import { EventEmitter } from "node:events";
import superjson from "superjson";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RealtimeEventEnvelope } from "@norish/shared/contracts/realtime/envelope";

const createSubscriberClient = vi.fn();
const logged = { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn(), trace: vi.fn() };

vi.mock("@norish/shared-server/redis/client", () => ({ createSubscriberClient }));

vi.mock("@norish/shared-server/logger", () => ({
  createLogger: () => logged,
}));

const { getRealtimeHub, RealtimeLaggedError, startRealtimeHub, stopRealtimeHub } =
  await import("../../src/realtime/hub");

/** A Redis subscriber connection: an EventEmitter that records SUBSCRIBE / UNSUBSCRIBE. */
class FakeSubscriber extends EventEmitter {
  readonly subscribed = new Set<string>();
  readonly calls: string[] = [];
  quit = vi.fn(async () => "OK");
  unsubscribe = vi.fn(async (channel?: string) => {
    this.calls.push(`unsubscribe:${channel ?? "*"}`);

    if (channel) this.subscribed.delete(channel);
    else this.subscribed.clear();

    return this.subscribed.size;
  });
  subscribe = vi.fn(async (channel: string) => {
    this.calls.push(`subscribe:${channel}`);
    this.subscribed.add(channel);

    return this.subscribed.size;
  });
}

const CHANNEL = "norish:grocery:household:hh-1:created";

function envelope(n: number, channel = CHANNEL): RealtimeEventEnvelope {
  return {
    meta: {
      version: 1,
      eventId: `1700000000000-${n}`,
      eventName: "created",
      namespace: "grocery",
      scope: "household",
      channel,
      occurredAt: "2024-01-01T00:00:00.000Z",
    },
    payload: { n },
  };
}

function deliver(subscriber: FakeSubscriber, n: number, channel = CHANNEL) {
  subscriber.emit("message", channel, superjson.stringify(envelope(n, channel)));
}

/** Let promise chains and parked `next()` calls settle. */
async function settle() {
  await new Promise((resolve) => setImmediate(resolve));
}

let subscriber: FakeSubscriber;

beforeEach(() => {
  vi.clearAllMocks();
  subscriber = new FakeSubscriber();
  createSubscriberClient.mockResolvedValue(subscriber);
});

afterEach(async () => {
  await stopRealtimeHub();
});

describe("start and stop", () => {
  it("rejects subscribe() before the hub is started", async () => {
    const iterable = getRealtimeHub().subscribe(CHANNEL);

    await expect(iterable[Symbol.asyncIterator]().next()).rejects.toThrow(/not started/);
    expect(createSubscriberClient).not.toHaveBeenCalled();
  });

  it("refuses on() before the hub is started", () => {
    expect(() => getRealtimeHub().on(CHANNEL, () => {})).toThrow(/not started/);
  });

  it("opens one subscriber connection regardless of how many subscribe", async () => {
    await startRealtimeHub();
    await startRealtimeHub();

    const controller = new AbortController();

    getRealtimeHub().subscribe(CHANNEL, { signal: controller.signal });
    getRealtimeHub().subscribe(`${CHANNEL}:other`, { signal: controller.signal });
    getRealtimeHub().on("norish:connection:internal:invalidate", () => {});
    await settle();

    expect(createSubscriberClient).toHaveBeenCalledTimes(1);
    expect(getRealtimeHub().stats().channels).toBe(3);
    controller.abort();
  });

  it("is the same hub on every access", () => {
    expect(getRealtimeHub()).toBe(getRealtimeHub());
  });

  it("ends every iterable cleanly, unsubscribes everything and quits on stop", async () => {
    await startRealtimeHub();

    const iterator = getRealtimeHub().subscribe(CHANNEL)[Symbol.asyncIterator]();
    const pending = iterator.next();

    await settle();
    await stopRealtimeHub();

    await expect(pending).resolves.toEqual({ value: undefined, done: true });
    expect(subscriber.unsubscribe).toHaveBeenCalledWith();
    expect(subscriber.quit).toHaveBeenCalledOnce();
    expect(getRealtimeHub().stats()).toEqual({ channels: 0, listeners: 0, dropped: 0 });
  });
});

describe("refcounting", () => {
  beforeEach(async () => {
    await startRealtimeHub();
  });

  it("SUBSCRIBEs on the first listener and UNSUBSCRIBEs on the last", async () => {
    const off1 = getRealtimeHub().on(CHANNEL, () => {});
    const off2 = getRealtimeHub().on(CHANNEL, () => {});

    await settle();
    expect(subscriber.calls).toEqual([`subscribe:${CHANNEL}`]);

    off1();
    await settle();
    expect(subscriber.calls).toEqual([`subscribe:${CHANNEL}`]);

    off2();
    await settle();
    expect(subscriber.calls).toEqual([`subscribe:${CHANNEL}`, `unsubscribe:${CHANNEL}`]);
    expect(getRealtimeHub().stats().channels).toBe(0);
  });

  it("leaves exactly one Redis subscription after subscribe → abort → subscribe in one tick", async () => {
    const first = new AbortController();
    const second = new AbortController();

    getRealtimeHub().subscribe(CHANNEL, { signal: first.signal });
    first.abort();
    getRealtimeHub().subscribe(CHANNEL, { signal: second.signal });

    await settle();

    expect(subscriber.subscribed).toEqual(new Set([CHANNEL]));
    expect(subscriber.calls).toEqual([`subscribe:${CHANNEL}`]);
    expect(getRealtimeHub().stats().listeners).toBe(1);
  });

  it("serialises Redis-side operations per channel so a resubscribe never races an unsubscribe", async () => {
    const controller = new AbortController();

    getRealtimeHub().subscribe(CHANNEL, { signal: controller.signal });
    await settle();
    controller.abort();

    const again = new AbortController();

    getRealtimeHub().subscribe(CHANNEL, { signal: again.signal });
    await settle();

    expect(subscriber.calls).toEqual([`subscribe:${CHANNEL}`]);
    expect(subscriber.subscribed).toEqual(new Set([CHANNEL]));

    again.abort();
    await settle();
    expect(subscriber.calls).toEqual([`subscribe:${CHANNEL}`, `unsubscribe:${CHANNEL}`]);
  });

  it("yields nothing before SUBSCRIBE resolves", async () => {
    let resolveSubscribe: (() => void) | undefined;

    subscriber.subscribe.mockImplementationOnce(
      () => new Promise<number>((resolve) => (resolveSubscribe = () => resolve(1)))
    );

    const iterator = getRealtimeHub().subscribe(CHANNEL)[Symbol.asyncIterator]();
    let yielded = false;
    const next = iterator.next().then((result) => {
      yielded = true;

      return result;
    });

    deliver(subscriber, 1);
    await settle();
    expect(yielded).toBe(false);

    resolveSubscribe?.();
    const result = await next;

    expect(yielded).toBe(true);
    expect(result.value).toEqual(envelope(1));
  });

  it("surfaces a failed SUBSCRIBE on the first next() and releases the listener", async () => {
    subscriber.subscribe.mockRejectedValueOnce(new Error("redis is down"));

    const iterator = getRealtimeHub().subscribe(CHANNEL)[Symbol.asyncIterator]();

    await expect(iterator.next()).rejects.toThrow("redis is down");
    expect(getRealtimeHub().stats().listeners).toBe(0);
  });
});

describe("fan-out", () => {
  beforeEach(async () => {
    await startRealtimeHub();
  });

  it("delivers a message to every listener on the channel and nobody else", async () => {
    const handler = vi.fn();
    const other = vi.fn();
    const controller = new AbortController();

    getRealtimeHub().on(CHANNEL, handler);
    getRealtimeHub().on(`${CHANNEL}:other`, other);
    const iterator = getRealtimeHub()
      .subscribe(CHANNEL, { signal: controller.signal })
      [Symbol.asyncIterator]();

    await settle();
    deliver(subscriber, 1);

    expect(handler).toHaveBeenCalledWith(envelope(1));
    expect(other).not.toHaveBeenCalled();
    await expect(iterator.next()).resolves.toEqual({ value: envelope(1), done: false });
    controller.abort();
  });

  it("drops a non-envelope message and logs it once per channel", async () => {
    const handler = vi.fn();

    getRealtimeHub().on(CHANNEL, handler);
    await settle();

    subscriber.emit("message", CHANNEL, superjson.stringify({ raw: true }));
    subscriber.emit("message", CHANNEL, "not-json");
    subscriber.emit("message", CHANNEL, superjson.stringify({ raw: true }));

    expect(handler).not.toHaveBeenCalled();
    expect(logged.warn).toHaveBeenCalledTimes(1);

    deliver(subscriber, 2);
    expect(handler).toHaveBeenCalledWith(envelope(2));
  });

  it("keeps delivering when a handler throws", async () => {
    const handler = vi.fn(() => {
      throw new Error("boom");
    });
    const sibling = vi.fn();

    getRealtimeHub().on(CHANNEL, handler);
    getRealtimeHub().on(CHANNEL, sibling);
    await settle();

    deliver(subscriber, 1);

    expect(sibling).toHaveBeenCalledWith(envelope(1));
    expect(logged.error).toHaveBeenCalledOnce();
  });

  it("ends only the slow iterable with queue-overflow while a sibling receives every message", async () => {
    const controller = new AbortController();
    const slow = getRealtimeHub()
      .subscribe(CHANNEL, { signal: controller.signal, maxQueue: 2 })
      [Symbol.asyncIterator]();
    const fast = getRealtimeHub()
      .subscribe(CHANNEL, { signal: controller.signal, maxQueue: 2 })
      [Symbol.asyncIterator]();

    await settle();

    // The fast sibling consumes as they arrive; the slow one never calls next().
    const received: number[] = [];
    const consume = (async () => {
      for (let i = 0; i < 3; i++) {
        const { value } = await fast.next();

        received.push((value as RealtimeEventEnvelope<{ n: number }>).payload.n);
      }
    })();

    deliver(subscriber, 1);
    await settle();
    deliver(subscriber, 2);
    await settle();
    deliver(subscriber, 3);
    await settle();

    await consume;
    expect(received).toEqual([1, 2, 3]);

    let caught: unknown;

    try {
      await slow.next();
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(RealtimeLaggedError);
    expect(caught).toMatchObject({ channel: CHANNEL, reason: "queue-overflow", dropped: 3 });
    expect(getRealtimeHub().stats()).toMatchObject({ listeners: 1, dropped: 3 });

    // The channel stays subscribed for the sibling.
    expect(subscriber.subscribed).toEqual(new Set([CHANNEL]));
    controller.abort();
  });
});

describe("abort", () => {
  beforeEach(async () => {
    await startRealtimeHub();
  });

  it("resolves a pending next() as done and releases the channel", async () => {
    const controller = new AbortController();
    const iterator = getRealtimeHub()
      .subscribe(CHANNEL, { signal: controller.signal })
      [Symbol.asyncIterator]();

    await settle();
    const pending = iterator.next();

    controller.abort();

    await expect(pending).resolves.toEqual({ value: undefined, done: true });
    await settle();
    expect(subscriber.calls).toEqual([`subscribe:${CHANNEL}`, `unsubscribe:${CHANNEL}`]);
    expect(getRealtimeHub().stats().channels).toBe(0);
  });

  it("registers nothing for an already-aborted signal", async () => {
    const controller = new AbortController();

    controller.abort();

    const iterator = getRealtimeHub()
      .subscribe(CHANNEL, { signal: controller.signal })
      [Symbol.asyncIterator]();

    await expect(iterator.next()).resolves.toEqual({ value: undefined, done: true });
    await settle();
    expect(subscriber.subscribe).not.toHaveBeenCalled();
  });

  it("releases the listener when the consumer returns early", async () => {
    const iterator = getRealtimeHub().subscribe(CHANNEL)[Symbol.asyncIterator]();

    await settle();
    expect(getRealtimeHub().stats().listeners).toBe(1);

    await expect(iterator.return?.()).resolves.toEqual({ value: undefined, done: true });
    await settle();
    expect(getRealtimeHub().stats().listeners).toBe(0);
    expect(subscriber.calls).toEqual([`subscribe:${CHANNEL}`, `unsubscribe:${CHANNEL}`]);
  });
});

describe("Redis reconnect", () => {
  beforeEach(async () => {
    await startRealtimeHub();
  });

  it("logs realtime.reconnected, ends live iterables with redis-reconnect and issues no SUBSCRIBE of its own", async () => {
    const handler = vi.fn();
    const controller = new AbortController();

    getRealtimeHub().on(CHANNEL, handler);
    const iterator = getRealtimeHub()
      .subscribe(`${CHANNEL}:live`, { signal: controller.signal })
      [Symbol.asyncIterator]();

    await settle();
    const pending = iterator.next();
    const callsBefore = [...subscriber.calls];

    // The first `ready` is the initial connection; the second is a reconnect.
    subscriber.emit("ready");
    subscriber.emit("ready");

    await expect(pending).rejects.toMatchObject({ reason: "redis-reconnect", dropped: 0 });
    expect(logged.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "realtime.reconnected",
        channels: [CHANNEL, `${CHANNEL}:live`],
      }),
      expect.any(String)
    );

    await settle();
    // ioredis resubscribes on its own; the hub only drops the channel nobody listens on any more.
    expect(subscriber.calls.filter((call) => call.startsWith("subscribe:"))).toEqual(
      callsBefore.filter((call) => call.startsWith("subscribe:"))
    );
    expect(subscriber.calls).toContain(`unsubscribe:${CHANNEL}:live`);

    // on() handlers stay registered.
    deliver(subscriber, 1);
    expect(handler).toHaveBeenCalledWith(envelope(1));
  });
});

describe("refcounting across a Redis round trip", () => {
  beforeEach(async () => {
    await startRealtimeHub();
  });

  it("keeps a listener that registers while the last listener's UNSUBSCRIBE is in flight", async () => {
    const first = new AbortController();

    getRealtimeHub().subscribe(CHANNEL, { signal: first.signal });
    await settle();
    expect(subscriber.calls).toEqual([`subscribe:${CHANNEL}`]);

    // Hold the UNSUBSCRIBE round trip open, the way a busy Redis would.
    let releaseUnsubscribe!: () => void;

    subscriber.unsubscribe.mockImplementationOnce(async (channel?: string) => {
      subscriber.calls.push(`unsubscribe:${channel ?? "*"}`);
      await new Promise<void>((resolve) => {
        releaseUnsubscribe = resolve;
      });
      if (channel) subscriber.subscribed.delete(channel);

      return subscriber.subscribed.size;
    });
    first.abort();
    await settle();
    expect(subscriber.calls).toEqual([`subscribe:${CHANNEL}`, `unsubscribe:${CHANNEL}`]);

    // The client's reset after a lag lands in that window: a new listener on
    // the same channel, registered before Redis has answered the UNSUBSCRIBE.
    const second = getRealtimeHub().subscribe(CHANNEL)[Symbol.asyncIterator]();
    const pending = second.next();

    releaseUnsubscribe();
    await settle();
    await settle();

    expect(subscriber.calls).toEqual([
      `subscribe:${CHANNEL}`,
      `unsubscribe:${CHANNEL}`,
      `subscribe:${CHANNEL}`,
    ]);
    expect(getRealtimeHub().stats()).toMatchObject({ channels: 1, listeners: 1 });

    deliver(subscriber, 1);
    await expect(pending).resolves.toEqual({ value: envelope(1), done: false });
    await second.return?.();
  });
});
