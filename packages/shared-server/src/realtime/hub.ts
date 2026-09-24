/**
 * Realtime Hub
 *
 * One per process. Holds exactly one Redis subscriber connection, subscribes
 * to exact channels by refcount, and fans out in-process: server-internal
 * listeners register callbacks with `on()`, tRPC subscriptions iterate
 * `subscribe()` through a bounded queue. A subscriber that falls behind is
 * Lagged — its iterable ends with a `RealtimeLaggedError` — and the client's
 * one reaction is to refetch that domain and resubscribe (ADR-0032).
 *
 * Nothing else in the process talks to Redis pub/sub on the receiving side.
 */

import type Redis from "ioredis";
import superjson from "superjson";

import type { RealtimeEventEnvelope } from "@norish/shared/contracts/realtime/envelope";
import { createLogger } from "@norish/shared-server/logger";
import { createSubscriberClient } from "@norish/shared-server/redis/client";
import { isEventEnvelope } from "@norish/shared/contracts/realtime/envelope";

const log = createLogger("realtime:hub");

export const DEFAULT_MAX_QUEUE = 100;

export type RealtimeLaggedReason =
  | "queue-overflow"
  | "redis-reconnect"
  | "cursor-invalid"
  | "cursor-expired"
  | "cursor-trimmed"
  | "identity-changed";

export class RealtimeLaggedError extends Error {
  override readonly name = "RealtimeLaggedError";

  constructor(
    readonly channel: string,
    readonly reason: RealtimeLaggedReason,
    readonly dropped: number
  ) {
    super(`Realtime subscription lagged on ${channel || "<no channel>"}: ${reason}`);
  }
}

export type RealtimeHandler = (envelope: RealtimeEventEnvelope) => void;

export interface RealtimeSubscribeOptions {
  signal?: AbortSignal;
  maxQueue?: number;
}

export interface RealtimeHubStats {
  channels: number;
  listeners: number;
  dropped: number;
}

export interface RealtimeHub {
  /** Callback, no queue: for server-internal listeners. Returns the unsubscribe. */
  on(channel: string, handler: RealtimeHandler): () => void;
  /**
   * Bounded async iterable: for tRPC subscriptions. The listener is registered
   * synchronously, so events published after this call are never missed; the
   * iterable yields nothing until the `SUBSCRIBE` round trip has resolved.
   */
  subscribe(channel: string, opts?: RealtimeSubscribeOptions): AsyncIterable<RealtimeEventEnvelope>;
  stats(): RealtimeHubStats;
}

/** One `subscribe()` caller: a bounded queue and a parked `next()`. */
class QueueListener {
  readonly queue: RealtimeEventEnvelope[] = [];
  /** Set once the listener has been removed from its channel. */
  ended = false;
  /** Set when the listener ended abnormally; thrown by the next `next()`. */
  error: RealtimeLaggedError | null = null;
  private wake: (() => void) | null = null;

  constructor(
    readonly channel: string,
    readonly maxQueue: number
  ) {}

  push(envelope: RealtimeEventEnvelope): boolean {
    if (this.ended) return true;

    if (this.queue.length >= this.maxQueue) {
      return false;
    }

    this.queue.push(envelope);
    this.notify();

    return true;
  }

  /**
   * End the iterable: cleanly after the queued events, or at once with an
   * error, in which case whatever was queued is dropped along with it.
   */
  end(error: RealtimeLaggedError | null): void {
    if (this.ended) return;

    this.ended = true;

    if (error) {
      this.queue.length = 0;
      this.error = error;
    }

    this.notify();
  }

  /** Resolves when there is something to report: an event, an error, or the end. */
  wait(): Promise<void> {
    if (this.queue.length > 0 || this.ended) return Promise.resolve();

    return new Promise<void>((resolve) => {
      this.wake = resolve;
    });
  }

  private notify(): void {
    const wake = this.wake;

    if (wake) {
      this.wake = null;
      wake();
    }
  }
}

interface ChannelState {
  handlers: Set<RealtimeHandler>;
  listeners: Set<QueueListener>;
  /** Whether Redis currently holds a `SUBSCRIBE` for this channel. */
  subscribed: boolean;
  /**
   * Every Redis-side operation for this channel runs through this chain, so
   * a fast resubscribe can never race an unsubscribe.
   */
  chain: Promise<void>;
}

/** How many callbacks and iterables a channel currently serves. */
function refcount(state: ChannelState): number {
  return state.handlers.size + state.listeners.size;
}

class RedisRealtimeHub implements RealtimeHub {
  private subscriber: Redis | null = null;
  private starting: Promise<void> | null = null;
  private readonly channels = new Map<string, ChannelState>();
  private readonly warnedChannels = new Set<string>();
  private readyCount = 0;
  private dropped = 0;

  get started(): boolean {
    return this.subscriber !== null;
  }

  async start(): Promise<void> {
    if (this.subscriber) return;

    if (this.starting) return this.starting;

    this.starting = this.connect().finally(() => {
      this.starting = null;
    });

    return this.starting;
  }

  private async connect(): Promise<void> {
    const subscriber = await createSubscriberClient();

    subscriber.on("message", (channel: string, message: string) => {
      this.dispatch(channel, message);
    });

    subscriber.on("ready", () => {
      this.readyCount += 1;

      if (this.readyCount > 1) {
        this.onReconnected();
      }
    });

    subscriber.on("end", () => {
      log.warn("Realtime hub subscriber connection ended");
    });

    // `duplicate()` of a lazy client is lazy too: connect explicitly so the
    // first `ready` is counted before any subscription is issued.
    if (subscriber.status === "wait") {
      await subscriber.connect();
    } else if (subscriber.status === "ready") {
      this.readyCount = 1;
    }

    this.subscriber = subscriber;
    log.info("Realtime hub started");
  }

  async stop(): Promise<void> {
    const subscriber = this.subscriber;

    if (!subscriber) return;

    this.subscriber = null;

    for (const [channel, state] of this.channels) {
      for (const listener of state.listeners) {
        listener.end(null);
      }
      state.listeners.clear();
      state.handlers.clear();
      this.channels.delete(channel);
    }

    try {
      await subscriber.unsubscribe();
      await subscriber.quit();
    } catch (err) {
      log.debug({ err }, "Error while stopping the realtime hub subscriber");
    }

    this.readyCount = 0;
    log.info("Realtime hub stopped");
  }

  on(channel: string, handler: RealtimeHandler): () => void {
    this.assertStarted();

    const state = this.stateFor(channel);

    state.handlers.add(handler);
    this.reconcile(channel);

    let removed = false;

    return () => {
      if (removed) return;
      removed = true;

      const current = this.channels.get(channel);

      if (!current) return;

      current.handlers.delete(handler);
      this.reconcile(channel);
    };
  }

  subscribe(
    channel: string,
    opts: RealtimeSubscribeOptions = {}
  ): AsyncIterable<RealtimeEventEnvelope> {
    if (!this.started) {
      const error = new Error("Realtime hub is not started");

      return {
        [Symbol.asyncIterator]: () => ({
          next: () => Promise.reject(error),
          return: () => Promise.resolve({ value: undefined, done: true as const }),
        }),
      };
    }

    const { signal, maxQueue = DEFAULT_MAX_QUEUE } = opts;
    const listener = new QueueListener(channel, maxQueue);
    const state = this.stateFor(channel);

    state.listeners.add(listener);

    const ready = this.reconcile(channel);

    // A subscription that fails to reach Redis surfaces on the first `next()`;
    // until then nobody awaits it, and an unhandled rejection is not the way
    // to report it.
    ready.catch(() => {});

    const release = () => {
      listener.end(null);
      signal?.removeEventListener("abort", release);

      if (!state.listeners.delete(listener)) return;

      this.reconcile(channel);
    };

    if (signal?.aborted) {
      release();
    } else {
      signal?.addEventListener("abort", release, { once: true });
    }

    const iterator: AsyncIterator<RealtimeEventEnvelope> = {
      next: async () => {
        try {
          await ready;
        } catch (err) {
          release();
          throw err;
        }

        for (;;) {
          const envelope = listener.queue.shift();

          if (envelope) {
            return { value: envelope, done: false };
          }

          if (listener.error) {
            const error = listener.error;

            listener.error = null;
            release();
            throw error;
          }

          if (listener.ended) {
            release();

            return { value: undefined, done: true };
          }

          await listener.wait();
        }
      },
      return: async () => {
        release();

        return { value: undefined, done: true };
      },
    };

    return { [Symbol.asyncIterator]: () => iterator };
  }

  stats(): RealtimeHubStats {
    let listeners = 0;

    for (const state of this.channels.values()) {
      listeners += refcount(state);
    }

    return { channels: this.channels.size, listeners, dropped: this.dropped };
  }

  private assertStarted(): void {
    if (!this.started) {
      throw new Error("Realtime hub is not started");
    }
  }

  private stateFor(channel: string): ChannelState {
    let state = this.channels.get(channel);

    if (!state) {
      state = {
        handlers: new Set(),
        listeners: new Set(),
        subscribed: false,
        chain: Promise.resolve(),
      };
      this.channels.set(channel, state);
    }

    return state;
  }

  /**
   * Bring the Redis-side subscription in line with the channel's refcount.
   * Queued on the channel's chain, so the decision is made when the step runs,
   * not when it was scheduled: subscribe → abort → subscribe in one tick issues
   * a single `SUBSCRIBE` and no `UNSUBSCRIBE`.
   */
  private reconcile(channel: string): Promise<void> {
    const state = this.channels.get(channel);

    if (!state) return Promise.resolve();

    const step = state.chain.then(async () => {
      const subscriber = this.subscriber;
      const current = this.channels.get(channel);

      if (!subscriber || !current || current !== state) return;

      const wanted = refcount(current) > 0;

      if (wanted && !current.subscribed) {
        await subscriber.subscribe(channel);
        current.subscribed = true;
        log.trace({ channel }, "Subscribed channel");
      } else if (!wanted && current.subscribed) {
        current.subscribed = false;
        await subscriber.unsubscribe(channel);
        log.trace({ channel }, "Unsubscribed channel");
      }

      // Decided again after the round trip: a listener that registered while
      // the UNSUBSCRIBE was in flight lives in this state and has its own step
      // queued behind this one. Dropping the state here would strand it —
      // registered, never subscribed, never delivered to.
      const stillWanted = refcount(current) > 0;

      if (!stillWanted && !current.subscribed && this.channels.get(channel) === current) {
        this.channels.delete(channel);
      }
    });

    // The chain itself never rejects, so one failed SUBSCRIBE does not poison
    // every later operation on the channel; the failure reaches the caller
    // whose step it was.
    state.chain = step.catch(() => {});

    return step;
  }

  private dispatch(channel: string, message: string): void {
    const state = this.channels.get(channel);

    if (!state) return;

    let parsed: unknown;

    try {
      parsed = superjson.parse(message);
    } catch (err) {
      this.warnOnce(channel, { err }, "Dropped unparseable realtime message");

      return;
    }

    if (!isEventEnvelope(parsed)) {
      this.warnOnce(channel, {}, "Dropped realtime message that is not an envelope");

      return;
    }

    for (const handler of state.handlers) {
      try {
        handler(parsed);
      } catch (err) {
        log.error({ err, channel }, "Realtime handler threw");
      }
    }

    for (const listener of state.listeners) {
      if (listener.push(parsed)) continue;

      // Overflow: only this listener ends, and everything it had not yet
      // consumed goes with the event that did not fit. Siblings on the channel
      // are unaffected.
      const dropped = listener.queue.length + 1;

      listener.end(new RealtimeLaggedError(channel, "queue-overflow", dropped));
      this.dropped += dropped;
      state.listeners.delete(listener);
      log.warn({ channel, dropped, maxQueue: listener.maxQueue }, "Realtime subscriber overflowed");
      this.reconcile(channel);
    }
  }

  private onReconnected(): void {
    const channels = [...this.channels.keys()];

    log.warn(
      { event: "realtime.reconnected", channels },
      "Redis reconnected; ending live subscriptions"
    );

    // ioredis re-issues every SUBSCRIBE itself (`autoResubscribe`); the hub
    // only tells its iterables that there is a gap they cannot see across.
    // `on()` handlers stay registered: internal listeners accept the loss window.
    for (const [channel, state] of this.channels) {
      if (state.listeners.size === 0) continue;

      for (const listener of state.listeners) {
        const dropped = listener.queue.length;

        listener.end(new RealtimeLaggedError(channel, "redis-reconnect", dropped));
        this.dropped += dropped;
      }

      state.listeners.clear();
      this.reconcile(channel);
    }
  }

  private warnOnce(channel: string, fields: Record<string, unknown>, message: string): void {
    if (this.warnedChannels.has(channel)) return;

    this.warnedChannels.add(channel);
    log.warn({ ...fields, channel }, message);
  }
}

// Read on every access, never copied into a module-local — see the note on
// `globalForRegistry` in packages/queue/src/registry.ts for why this module is
// evaluated more than once per process.
const globalForHub = globalThis as unknown as {
  realtimeHub: RedisRealtimeHub | undefined;
};

function hubInstance(): RedisRealtimeHub {
  return (globalForHub.realtimeHub ??= new RedisRealtimeHub());
}

export function getRealtimeHub(): RealtimeHub {
  return hubInstance();
}

/** Open the one subscriber connection. Awaited at startup before any listener registers. */
export function startRealtimeHub(): Promise<void> {
  return hubInstance().start();
}

/** End every iterable cleanly, unsubscribe everything and quit the connection. */
export function stopRealtimeHub(): Promise<void> {
  return hubInstance().stop();
}
