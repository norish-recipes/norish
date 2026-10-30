/**
 * BullMQ Valkey Connection Management
 *
 * Provides a shared Valkey connection for BullMQ producers (Queue.add).
 *
 * IMPORTANT: When passed to Workers, BullMQ internally duplicates this
 * connection to create separate blocking (for job polling) and non-blocking
 * (for commands) connections. Workers don't share a single socket - they
 * share connection OPTIONS via this template connection.
 */

import type { RedisOptions } from "ioredis";
import Valkey from "ioredis";

import { createLogger } from "@norish/shared-server/logger";
import { getValkeyConnectionOptions } from "@norish/shared-server/valkey/client";

const log = createLogger("valkey:bullmq");

// Read on every access, never copied into a module-local — see the note on
// `globalForRegistry` in ../registry.ts for why this module is evaluated more
// than once per process. Here the cost of getting it wrong is one "shared"
// Valkey connection per instance.
const globalForBull = globalThis as unknown as {
  bullClient: Valkey | null;
};

/**
 * Longer than the longest block BullMQ asks Valkey for (ten seconds), so only a
 * socket that stopped answering is dropped: a command can no longer hang for
 * minutes on a connection a Valkey restart left half-open.
 */
export const BULL_SOCKET_TIMEOUT_MS = 15_000;

/**
 * The shared Valkey options plus what BullMQ needs on top: it connects at once,
 * a command waits out an outage in the offline queue instead of failing, no
 * ready check holds the connection back, and a dead socket is dropped.
 */
export function getBullConnectionOptions(url?: string): RedisOptions {
  return {
    ...getValkeyConnectionOptions(url),
    lazyConnect: false,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    enableOfflineQueue: true,
    socketTimeout: BULL_SOCKET_TIMEOUT_MS,
  };
}

/**
 * Get the shared BullMQ Valkey connection (singleton).
 *
 * For Queues (producers): This connection is reused directly.
 * For Workers: BullMQ duplicates this connection internally to create
 * separate blocking/non-blocking connections. The connection passed
 * serves as a template for connection options.
 */
export function getBullClient(): Valkey {
  const existing = globalForBull.bullClient;

  // Check if existing client is still usable
  if (existing && existing.status !== "end" && existing.status !== "close") {
    return existing;
  }

  // Clean up old client listeners before creating new one
  if (existing) {
    existing.removeAllListeners();
  }

  // Create new client if none exists or previous one was closed
  const bullClient = new Valkey({
    ...getBullConnectionOptions(),
    connectionName: `norish:${process.pid}:bull`,
  });

  bullClient.on("error", (err) => {
    log.error({ err }, "BullMQ Valkey error");
  });

  bullClient.on("connect", () => {
    log.debug("BullMQ Valkey connected");
  });

  bullClient.on("close", () => {
    log.debug("BullMQ Valkey closed");
  });

  globalForBull.bullClient = bullClient;

  return bullClient;
}

/**
 * Close the shared BullMQ connection. Shutdown calls this after every worker
 * and queue has closed, so nothing is in flight: it disconnects rather than
 * sending a QUIT that a socket left half-open by a Valkey restart never answers.
 */
export async function closeBullConnection(): Promise<void> {
  const bullClient = globalForBull.bullClient;

  if (bullClient && bullClient.status !== "end") {
    bullClient.disconnect();
    globalForBull.bullClient = null;
    log.info("BullMQ Valkey connection closed");
  }
}
