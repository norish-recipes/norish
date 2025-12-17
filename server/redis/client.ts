/**
 * Redis Client Singleton
 *
 * Provides connection management for Redis pub/sub.
 * Redis requires separate connections for subscribers (they enter "subscribe mode").
 */

import Redis from "ioredis";

import { SERVER_CONFIG } from "@/config/env-config-server";
import { createLogger } from "@/server/logger";

const log = createLogger("redis");

let publisherClient: Redis | null = null;
let connectionPromise: Promise<Redis> | null = null;

/**
 * Get the publisher client (singleton).
 * Used for PUBLISH operations.
 */
export async function getPublisherClient(): Promise<Redis> {
  if (publisherClient && publisherClient.status === "ready") {
    return publisherClient;
  }

  // Prevent multiple simultaneous connection attempts
  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = connectPublisher();

  try {
    publisherClient = await connectionPromise;

    return publisherClient;
  } finally {
    connectionPromise = null;
  }
}

async function connectPublisher(): Promise<Redis> {
  log.info({ url: SERVER_CONFIG.REDIS_URL }, "Connecting to Redis");

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
  if (publisherClient && publisherClient.status !== "end") {
    log.info("Closing Redis connections");
    await publisherClient.quit();
    publisherClient = null;
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
