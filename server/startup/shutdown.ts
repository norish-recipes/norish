/**
 * Graceful Shutdown Handler
 *
 * Manages coordinated shutdown of all server components with timeouts
 * to prevent zombie processes. Ensures resources are released in the
 * correct order: HTTP -> CalDAV -> Workers -> Redis.
 */

import type { Server } from "node:http";

import { stopCaldavSync } from "@/server/caldav/event-listener";
import { stopWorkers } from "@/server/queue/start-workers";
import { closeRedisConnections } from "@/server/redis/client";
import { serverLogger as log } from "@/server/logger";

// Shutdown timeouts
const SHUTDOWN_TIMEOUT_MS = 30_000; // 30 seconds per operation
const FORCE_EXIT_TIMEOUT_MS = 60_000; // 60 seconds total before force exit

/**
 * Execute a promise with a timeout. Rejects if the operation
 * doesn't complete within the specified time.
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string
): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${operation} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId!);
  }
}

/**
 * Promisify server.close() for async/await usage.
 */
function closeHttpServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) {
        log.error({ err }, "Error closing HTTP server");
        reject(err);
      } else {
        log.info("HTTP server closed");
        resolve();
      }
    });
  });
}

// Track shutdown state to prevent multiple invocations
let isShuttingDown = false;

/**
 * Perform graceful shutdown of all server components.
 *
 * Shutdown order:
 * 1. HTTP server - stop accepting new connections, drain existing
 * 2. CalDAV sync - abort event subscriptions
 * 3. BullMQ workers - complete current jobs, close queues
 * 4. Redis connections - close after all consumers stopped
 */
async function performShutdown(server: Server, signal: string): Promise<void> {
  if (isShuttingDown) return;
  isShuttingDown = true;

  log.info(`Received ${signal}, starting graceful shutdown...`);

  // Force exit after timeout to prevent zombie process
  const forceExitTimeout = setTimeout(() => {
    log.error("Graceful shutdown timed out, forcing exit");
    process.exit(1);
  }, FORCE_EXIT_TIMEOUT_MS);

  forceExitTimeout.unref();

  try {
    // 1. Stop accepting new connections and drain existing
    try {
      await withTimeout(closeHttpServer(server), SHUTDOWN_TIMEOUT_MS, "HTTP server close");
    } catch (err) {
      log.warn({ err }, "HTTP server close failed or timed out, continuing shutdown");
    }

    // 2. Stop CalDAV sync service (aborts event subscriptions)
    stopCaldavSync();
    log.info("CalDAV sync service stopped");

    // 3. Stop all BullMQ workers and close queues
    await withTimeout(stopWorkers(), SHUTDOWN_TIMEOUT_MS, "Stop workers");

    // 4. Close Redis pub/sub connections (after all consumers stopped)
    await withTimeout(closeRedisConnections(), SHUTDOWN_TIMEOUT_MS, "Close Redis");
    log.info("Redis connections closed");

    clearTimeout(forceExitTimeout);
    log.info("Graceful shutdown completed");
    process.exit(0);
  } catch (err) {
    clearTimeout(forceExitTimeout);
    log.error({ err }, "Error during graceful shutdown");
    process.exit(1);
  }
}

/**
 * Register shutdown handlers for SIGTERM and SIGINT.
 * Call this after the HTTP server is created.
 */
export function registerShutdownHandlers(server: Server): void {
  process.on("SIGTERM", () => performShutdown(server, "SIGTERM"));
  process.on("SIGINT", () => performShutdown(server, "SIGINT"));
}
