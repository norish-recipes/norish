/**
 * Redis Client Singleton
 *
 * The only module that opens a Redis connection for pub/sub. The publisher is
 * a process-wide singleton; subscribers are duplicated from it because a Redis
 * client in subscribe mode cannot run other commands.
 */

import type { RedisOptions } from "ioredis";
import Redis from "ioredis";

import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { createLogger, redactUrl } from "@norish/shared-server/logger";

import { parseRedisUrl } from "./url";

const log = createLogger("redis");

/** Longest pause between reconnection attempts. The strategy never gives up. */
export const REDIS_RETRY_MAX_DELAY_MS = 5_000;
export const REDIS_KEEP_ALIVE_MS = 30_000;
export const REDIS_CONNECT_TIMEOUT_MS = 10_000;

// Read on every access, never copied into a module-local — see the note on
// `globalForRegistry` in packages/queue/src/registry.ts for why this module is
// evaluated more than once per process. Here the cost of getting it wrong is
// one connection per instance, of which shutdown closes only the one it can see.
const globalForRedis = globalThis as unknown as {
  publisherClient: Redis | null;
  connectionPromise: Promise<Redis> | null;
};

/**
 * Exponential backoff, capped, and never `null`: pub/sub must keep trying for
 * as long as the process lives. Returning `null` would make ioredis give up,
 * after which every subscription in the process is silently dead.
 */
export function redisRetryStrategy(times: number): number {
  return Math.min(1_000 * 2 ** Math.max(0, times - 1), REDIS_RETRY_MAX_DELAY_MS);
}

/** Connection options shared by the publisher and every subscriber. */
export function getRedisConnectionOptions(url = SERVER_CONFIG.REDIS_URL): RedisOptions {
  return {
    ...parseRedisUrl(url),
    lazyConnect: true,
    maxRetriesPerRequest: null,
    keepAlive: REDIS_KEEP_ALIVE_MS,
    connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
    retryStrategy: redisRetryStrategy,
  };
}

/**
 * Get the publisher client (singleton).
 * Used for PUBLISH operations and every non-subscribe command.
 */
export async function getPublisherClient(): Promise<Redis> {
  const existing = globalForRedis.publisherClient;

  if (existing && existing.status === "ready") {
    return existing;
  }

  // Prevent multiple simultaneous connection attempts
  const inFlight = globalForRedis.connectionPromise;

  if (inFlight) {
    return inFlight;
  }

  const connectionPromise = connectPublisher();

  globalForRedis.connectionPromise = connectionPromise;

  try {
    const publisherClient = await connectionPromise;

    globalForRedis.publisherClient = publisherClient;

    return publisherClient;
  } finally {
    globalForRedis.connectionPromise = null;
  }
}

async function connectPublisher(): Promise<Redis> {
  log.info({ url: redactUrl(SERVER_CONFIG.REDIS_URL) }, "Connecting to Redis");

  const client = new Redis(getRedisConnectionOptions());

  client.on("error", (err) => {
    log.error({ err }, "Redis client error");
  });

  client.on("reconnecting", () => {
    log.warn("Redis client reconnecting");
  });

  await client.connect();
  log.info("Redis publisher connected");

  return client;
}

/**
 * Create a new subscriber client.
 * Each subscriber needs its own connection because Redis clients
 * enter "subscribe mode" and can't do other operations.
 */
export async function createSubscriberClient(): Promise<Redis> {
  const publisher = await getPublisherClient();
  const subscriber = publisher.duplicate();

  subscriber.on("error", (err) => {
    log.error({ err }, "Redis subscriber error");
  });

  log.trace("Redis subscriber connected");

  return subscriber;
}

/**
 * Gracefully close all Redis connections.
 * Call during server shutdown.
 */
export async function closeRedisConnections(): Promise<void> {
  const publisherClient = globalForRedis.publisherClient;

  if (publisherClient && publisherClient.status !== "end") {
    log.info("Closing Redis connections");
    await publisherClient.quit();
    globalForRedis.publisherClient = null;
  }
}
