/**
 * Redis Client Singleton
 *
 * Provides connection management for Redis pub/sub.
 * Redis requires separate connections for subscribers (they enter "subscribe mode").
 */

import Redis from "ioredis";

import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { createLogger, redactUrl } from "@norish/shared-server/logger";

const log = createLogger("redis");

// Read on every access, never copied into a module-local — see the note on
// `globalForRegistry` in ../registry.ts for why this module is evaluated more
// than once per process. Here the cost of getting it wrong is one connection
// per instance, of which shutdown closes only the one it can see.
const globalForRedis = globalThis as unknown as {
  publisherClient: Redis | null;
  connectionPromise: Promise<Redis> | null;
};

/**
 * Get the publisher client (singleton).
 * Used for PUBLISH operations.
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

  const client = new Redis(SERVER_CONFIG.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: null,
  });

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

/**
 * Health check - verify Redis is reachable.
 */
export async function checkRedisHealth(): Promise<boolean> {
  try {
    const client = await getPublisherClient();
    const pong = await client.ping();

    return pong === "PONG";
  } catch (err) {
    log.error({ err }, "Redis health check failed");

    return false;
  }
}
