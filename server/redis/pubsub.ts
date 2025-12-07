/**
 * Redis Pub/Sub TypedEmitter
 *
 * Uses Redis PUBLISH/SUBSCRIBE for distributed event handling.
 * All subscriptions use createSubscription() with async iterators.
 */

import superjson from "superjson";

import { getPublisherClient, createSubscriberClient } from "./client";

import { redisLogger } from "@/server/logger";

const CHANNEL_PREFIX = "norish";

/**
 * Redis-backed typed event emitter.
 */
export class TypedRedisEmitter<TEvents extends Record<string, unknown>> {
  async emitToHousehold<K extends keyof TEvents & string>(
    householdKey: string,
    event: K,
    data: TEvents[K]
  ): Promise<boolean> {
    const channel = this.householdEvent(householdKey, event);

    return this.publish(channel, data);
  }

  householdEvent<K extends keyof TEvents & string>(householdKey: string, event: K): string {
    return `${CHANNEL_PREFIX}:household:${householdKey}:${event}`;
  }

  async emitToUser<K extends keyof TEvents & string>(
    userId: string,
    event: K,
    data: TEvents[K]
  ): Promise<boolean> {
    const channel = this.userEvent(userId, event);

    return this.publish(channel, data);
  }

  userEvent<K extends keyof TEvents & string>(userId: string, event: K): string {
    return `${CHANNEL_PREFIX}:user:${userId}:${event}`;
  }

  async broadcast<K extends keyof TEvents & string>(event: K, data: TEvents[K]): Promise<boolean> {
    const channel = this.broadcastEvent(event);

    return this.publish(channel, data);
  }

  broadcastEvent<K extends keyof TEvents & string>(event: K): string {
    return `${CHANNEL_PREFIX}:broadcast:${event}`;
  }

  async emitGlobal<K extends keyof TEvents & string>(event: K, data: TEvents[K]): Promise<boolean> {
    const channel = this.globalEvent(event);

    return this.publish(channel, data);
  }

  globalEvent<K extends keyof TEvents & string>(event: K): string {
    return `${CHANNEL_PREFIX}:global:${event}`;
  }

  /**
   * Create an async iterable subscription.
   * Use with for-await-of to receive events.
   */
  async *createSubscription<K extends keyof TEvents & string>(
    channel: string,
    signal?: AbortSignal
  ): AsyncGenerator<TEvents[K]> {
    const subscriber = await createSubscriberClient();
    const queue: TEvents[K][] = [];
    let resolveNext: ((value: TEvents[K]) => void) | null = null;
    let isAborted = false;

    const cleanup = async () => {
      isAborted = true;
      try {
        await subscriber.unsubscribe(channel);
        await subscriber.quit();
      } catch (err) {
        redisLogger.debug({ err, channel }, "Error during subscription cleanup");
      }
    };

    signal?.addEventListener("abort", () => {
      cleanup();
    });

    await subscriber.subscribe(channel, (message: string) => {
      try {
        const data = superjson.parse<TEvents[K]>(message);

        if (resolveNext) {
          resolveNext(data);
          resolveNext = null;
        } else {
          queue.push(data);
        }
      } catch (err) {
        redisLogger.error({ err, channel, message }, "Failed to parse Redis message");
      }
    });

    redisLogger.debug({ channel }, "Started Redis subscription");

    try {
      while (!isAborted) {
        if (queue.length > 0) {
          yield queue.shift()!;
        } else {
          const data = await new Promise<TEvents[K]>((resolve) => {
            resolveNext = resolve;
          });

          if (!isAborted) {
            yield data;
          }
        }
      }
    } finally {
      await cleanup();
      redisLogger.debug({ channel }, "Ended Redis subscription");
    }
  }

  private async publish(channel: string, data: unknown): Promise<boolean> {
    try {
      const client = await getPublisherClient();
      const message = superjson.stringify(data);
      const subscribers = await client.publish(channel, message);

      redisLogger.debug({ channel, subscribers }, "Published message");

      return subscribers > 0;
    } catch (err) {
      redisLogger.error({ err, channel }, "Failed to publish message");

      return false;
    }
  }
}

export function createTypedEmitter<
  TEvents extends Record<string, unknown>,
>(): TypedRedisEmitter<TEvents> {
  return new TypedRedisEmitter<TEvents>();
}

export { TypedRedisEmitter as TypedEmitter };

