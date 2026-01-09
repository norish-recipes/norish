/**
 * BullMQ Redis Connection Management
 *
 * Provides a shared Redis connection for BullMQ producers (Queue.add).
 *
 * IMPORTANT: When passed to Workers, BullMQ internally duplicates this
 * connection to create separate blocking (for job polling) and non-blocking
 * (for commands) connections. Workers don't share a single socket - they
 * share connection OPTIONS via this template connection.
 */

import type { RedisOptions } from "ioredis";

import Redis from "ioredis";

import { SERVER_CONFIG } from "@/config/env-config-server";
import { createLogger } from "@/server/logger";

const log = createLogger("redis:bullmq");

// Use globalThis to survive HMR in development
const globalForBull = globalThis as unknown as {
  bullClient: Redis | null;
};

/**
 * Parse Redis URL into connection options
 */
function parseRedisUrl(url: string): { host: string; port: number; password?: string } {
  const parsed = new URL(url);

  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || "6379", 10),
    password: parsed.password || undefined,
  };
}

/**
 * Base Redis options optimized for BullMQ
 */
function getBaseOptions(): RedisOptions {
  const { host, port, password } = parseRedisUrl(SERVER_CONFIG.REDIS_URL);

  return {
    host,
    port,
    password,
    maxRetriesPerRequest: null,

    // Performance optimizations
    enableReadyCheck: false,
    enableOfflineQueue: true,

    lazyConnect: false,
    keepAlive: 30_000,
    connectTimeout: 10_000,

    // Retry strategy with exponential backoff
    retryStrategy: (times: number) => {
      if (times > 20) {
        log.error({ times }, "Redis connection failed after max retries");

        return null; // Stop retrying
      }

      const delay = Math.min(Math.exp(times), 20_000);

      log.warn({ times, delay }, "Redis connection retry");

      return delay;
    },
  };
}

// Singleton instance (survives HMR)
let bullClient = globalForBull.bullClient ?? null;

/**
 * Get the shared BullMQ Redis connection (singleton).
 *
 * For Queues (producers): This connection is reused directly.
 * For Workers: BullMQ duplicates this connection internally to create
 * separate blocking/non-blocking connections. The connection passed
 * serves as a template for connection options.
 */
export function getBullClient(): Redis {
  // Check if existing client is still usable
  if (bullClient && bullClient.status !== "end" && bullClient.status !== "close") {
    return bullClient;
  }

  // Clean up old client listeners before creating new one
  if (bullClient) {
    bullClient.removeAllListeners();
  }

  // Create new client if none exists or previous one was closed
  bullClient = new Redis({
    ...getBaseOptions(),
    connectionName: `norish:${process.pid}:bull`,
  });

  bullClient.on("error", (err) => {
    log.error({ err }, "BullMQ Redis error");
  });

  bullClient.on("connect", () => {
    log.debug("BullMQ Redis connected");
  });

  bullClient.on("close", () => {
    log.debug("BullMQ Redis closed");
  });

  globalForBull.bullClient = bullClient;

  return bullClient;
}

/**
 * Close the BullMQ Redis connection.
 * Call during server shutdown.
 */
export async function closeBullConnection(): Promise<void> {
  if (bullClient && bullClient.status !== "end") {
    await bullClient.quit();
    bullClient = null;
    globalForBull.bullClient = null;
    log.info("BullMQ Redis connection closed");
  }
}
