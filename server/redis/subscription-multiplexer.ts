/**
 * Subscription Multiplexer
 *
 * Consolidates multiple Redis subscriptions into a single connection per WebSocket client.
 * Instead of creating N Redis connections for N channel subscriptions, we use PSUBSCRIBE
 * with patterns and route messages to the appropriate async iterators.
 *
 * Architecture:
 * - One Redis subscriber connection per multiplexer instance
 * - Uses PSUBSCRIBE with patterns like `norish:*:household:{householdKey}:*`
 * - Routes incoming messages to registered channel listeners
 * - Automatic cleanup when all listeners unsubscribe
 */

import type Redis from "ioredis";

import { EventEmitter } from "node:events";

import superjson from "superjson";

import { createSubscriberClient } from "./client";

import { redisLogger as log } from "@/server/logger";

const CHANNEL_PREFIX = "norish";

/**
 * A multiplexed subscription manager that uses a single Redis connection
 * for all subscriptions belonging to a specific user/household context.
 */
export class SubscriptionMultiplexer {
  private subscriber: Redis | null = null;
  private readonly emitter = new EventEmitter();
  private readonly subscribedPatterns = new Set<string>();
  private readonly channelListenerCounts = new Map<string, number>();
  private initPromise: Promise<void> | null = null;
  private closed = false;

  constructor(
    private readonly userId: string,
    private readonly householdKey: string | null
  ) {
    this.emitter.setMaxListeners(0);
  }

  /**
   * Initialize the Redis subscriber and subscribe to the user's patterns.
   * Uses PSUBSCRIBE to listen to all relevant channels with a single connection.
   */
  private async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    if (this.closed) return;

    // Reset initPromise on failure so future calls can retry
    this.initPromise = this.doInit().catch((err) => {
      this.initPromise = null;
      throw err;
    });

    return this.initPromise;
  }

  private async doInit(): Promise<void> {
    this.subscriber = await createSubscriberClient();

    // Subscribe to patterns for this user's context:
    // 1. Broadcast events: norish:*:broadcast:*
    // 2. User-specific events: norish:*:user:{userId}:*
    // 3. Household events (only if user has a household): norish:*:household:{householdKey}:*
    const patterns = [
      `${CHANNEL_PREFIX}:*:broadcast:*`,
      `${CHANNEL_PREFIX}:*:user:${this.userId}:*`,
    ];

    // Only subscribe to household pattern if user belongs to a household
    if (this.householdKey) {
      patterns.push(`${CHANNEL_PREFIX}:*:household:${this.householdKey}:*`);
    }

    // Subscribe to all patterns concurrently
    await Promise.all(
      patterns.map(async (pattern) => {
        await this.subscriber!.psubscribe(pattern);
        this.subscribedPatterns.add(pattern);
        log.trace({ pattern }, "Multiplexer subscribed to pattern");
      })
    );

    // Handle incoming messages and route to appropriate listeners
    this.subscriber.on("pmessage", (_pattern: string, channel: string, message: string) => {
      if (this.emitter.listenerCount(channel) === 0) return;

      queueMicrotask(() => {
        try {
          this.emitter.emit(channel, superjson.parse(message));
        } catch (err) {
          log.error({ err, channel }, "Failed to parse multiplexed message");
        }
      });
    });

    this.subscriber.on("error", (err) => {
      log.error({ err }, "Multiplexer subscriber error");
    });

    log.debug(
      { userId: this.userId, householdKey: this.householdKey, patternCount: patterns.length },
      "Subscription multiplexer initialized"
    );
  }

  /**
   * Create an async iterable subscription for a specific channel.
   * Multiple subscriptions to the same channel share the underlying connection.
   */
  async *subscribe<T>(channel: string, signal?: AbortSignal): AsyncGenerator<T> {
    if (this.closed) return;
    if (signal?.aborted) return;

    await this.init();

    // Track listener count for this channel
    const currentCount = this.channelListenerCounts.get(channel) ?? 0;

    this.channelListenerCounts.set(channel, currentCount + 1);

    log.trace({ channel, listenerCount: currentCount + 1 }, "Added multiplexed listener");

    // Create a queue for incoming messages
    const queue: T[] = [];
    let resolve: (() => void) | null = null;
    let rejected = false;
    let cleanedUp = false;

    const listener = (data: T) => {
      queue.push(data);
      if (resolve) {
        const r = resolve;

        resolve = null;
        queueMicrotask(r);
      }
    };

    const cleanup = () => {
      // Make cleanup idempotent to prevent double-cleanup crashes
      if (cleanedUp) return;
      cleanedUp = true;

      this.emitter.off(channel, listener);
      const count = this.channelListenerCounts.get(channel) ?? 1;

      if (count <= 1) {
        this.channelListenerCounts.delete(channel);
      } else {
        this.channelListenerCounts.set(channel, count - 1);
      }
      log.trace({ channel, listenerCount: count - 1 }, "Removed multiplexed listener");
      rejected = true;
      resolve?.();
    };

    this.emitter.on(channel, listener);

    // Handle abort signal
    signal?.addEventListener("abort", cleanup, { once: true });

    try {
      while (!rejected && !this.closed) {
        if (signal?.aborted) break;

        // Yield any queued messages first
        if (queue.length > 0) {
          yield queue.shift()!;
          continue;
        }

        // Wait for next message
        await new Promise<void>((r) => {
          if (rejected || this.closed) return r();
          resolve = r;
        });
      }
    } finally {
      signal?.removeEventListener("abort", cleanup);
      cleanup();
    }
  }

  /**
   * Close the multiplexer and release all resources.
   */
  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;

    log.debug(
      { userId: this.userId, householdKey: this.householdKey },
      "Closing subscription multiplexer"
    );

    // Remove all listeners
    this.emitter.removeAllListeners();
    this.channelListenerCounts.clear();

    // Unsubscribe and close Redis connection
    if (this.subscriber) {
      try {
        for (const pattern of this.subscribedPatterns) {
          await this.subscriber.punsubscribe(pattern);
        }
        await this.subscriber.quit();
      } catch (err) {
        log.debug({ err }, "Error during multiplexer cleanup");
      }
      this.subscriber = null;
    }

    this.subscribedPatterns.clear();
  }

  /**
   * Check if multiplexer has been explicitly closed.
   */
  get isClosed(): boolean {
    return this.closed;
  }

  /**
   * Check if multiplexer is still active.
   * Returns true if not closed and either initialized or currently initializing.
   * This prevents race conditions where multiple subscriptions start before init() completes.
   */
  get isActive(): boolean {
    return !this.closed && (this.subscriber !== null || this.initPromise !== null);
  }

  /**
   * Get the number of active channel listeners.
   */
  get activeListenerCount(): number {
    let total = 0;

    for (const count of this.channelListenerCounts.values()) {
      total += count;
    }

    return total;
  }
}

/**
 * Registry of active multiplexers by WebSocket connection.
 * Each WebSocket gets its own multiplexer instance.
 * Uses globalThis to survive HMR in development and ensure single registry instance.
 */
const globalForMultiplexer = globalThis as unknown as {
  multiplexerRegistry: Map<string, SubscriptionMultiplexer> | undefined;
};

const multiplexerRegistry =
  globalForMultiplexer.multiplexerRegistry ??
  (globalForMultiplexer.multiplexerRegistry = new Map<string, SubscriptionMultiplexer>());

/**
 * Get or create a multiplexer for a WebSocket connection.
 * The connectionId should be unique per WebSocket (e.g., generated on connection).
 */
export function getOrCreateMultiplexer(
  connectionId: string,
  userId: string,
  householdKey: string | null
): SubscriptionMultiplexer {
  let multiplexer = multiplexerRegistry.get(connectionId);

  // Only create a new multiplexer if one doesn't exist or was explicitly closed.
  // Don't check isActive here - a multiplexer is valid even before init() is called.
  if (!multiplexer || multiplexer.isClosed) {
    multiplexer = new SubscriptionMultiplexer(userId, householdKey);
    multiplexerRegistry.set(connectionId, multiplexer);
    log.debug({ connectionId, userId, householdKey }, "Created new multiplexer");
  }

  return multiplexer;
}

/**
 * Close and remove a multiplexer when WebSocket disconnects.
 */
export async function closeMultiplexer(connectionId: string): Promise<void> {
  const multiplexer = multiplexerRegistry.get(connectionId);

  if (multiplexer) {
    await multiplexer.close();
    multiplexerRegistry.delete(connectionId);
    log.debug({ connectionId }, "Closed and removed multiplexer");
  }
}

/**
 * Get stats about active multiplexers (for debugging/monitoring).
 */
export function getMultiplexerStats(): { count: number; totalListeners: number } {
  let totalListeners = 0;

  for (const mux of multiplexerRegistry.values()) {
    totalListeners += mux.activeListenerCount;
  }

  return {
    count: multiplexerRegistry.size,
    totalListeners,
  };
}
