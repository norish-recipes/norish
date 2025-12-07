/**
 * Redis Client Singleton
 *
 * Provides connection management for Redis pub/sub.
 * Redis requires separate connections for subscribers (they enter "subscribe mode").
 */

import { createClient, RedisClientType } from "redis";

import { SERVER_CONFIG } from "@/config/env-config-server";
import { createLogger } from "@/server/logger";

const log = createLogger("redis");

type RedisClient = RedisClientType;

let publisherClient: RedisClient | null = null;
let isConnecting = false;
let connectionPromise: Promise<RedisClient> | null = null;

/**
 * Get the publisher client (singleton).
 * Used for PUBLISH operations.
 */
export async function getPublisherClient(): Promise<RedisClient> {
  if (publisherClient?.isOpen) {
    return publisherClient;
  }

  // Prevent multiple simultaneous connection attempts
  if (isConnecting && connectionPromise) {
    return connectionPromise;
  }

  isConnecting = true;
  connectionPromise = connectPublisher();

  try {
    publisherClient = await connectionPromise;

    return publisherClient;
  } finally {
    isConnecting = false;
    connectionPromise = null;
  }
}

async function connectPublisher(): Promise<RedisClient> {
  log.info({ url: SERVER_CONFIG.REDIS_URL }, "Connecting to Redis");

  const client = createClient({
    url: SERVER_CONFIG.REDIS_URL,
  });

  client.on("error", (err) => {
    log.error({ err }, "Redis client error");
  });

  client.on("reconnecting", () => {
    log.warn("Redis client reconnecting");
  });

  await client.connect();
  log.info("Redis publisher connected");

  return client as RedisClient;
}

/**
 * Create a new subscriber client.
 * Each subscriber needs its own connection because Redis clients
 * enter "subscribe mode" and can't do other operations.
 */
export async function createSubscriberClient(): Promise<RedisClient> {
  const publisher = await getPublisherClient();
  const subscriber = publisher.duplicate();

  subscriber.on("error", (err) => {
    log.error({ err }, "Redis subscriber error");
  });

  await subscriber.connect();
  log.debug("Redis subscriber connected");

  return subscriber as RedisClient;
}

/**
 * Gracefully close all Redis connections.
 * Call during server shutdown.
 */
export async function closeRedisConnections(): Promise<void> {
  if (publisherClient?.isOpen) {
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
