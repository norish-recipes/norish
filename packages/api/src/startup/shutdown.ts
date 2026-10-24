/**
 * Graceful Shutdown Handler
 *
 * Manages coordinated shutdown of all server components with timeouts
 * to prevent zombie processes. Ensures resources are released in the
 * correct order: HTTP → WebSocket → internal listeners → workers → hub → Valkey.
 */

import type { Server } from "node:http";

import { stopCaldavSync } from "@norish/api/caldav/event-listener";
import { stopRecipeEnrichmentListener } from "@norish/api/recipes/enrichment-listener";
import { stopWorkers } from "@norish/queue/start-workers";
import { serverLogger as log } from "@norish/shared-server/logger";
import { stopRealtimeHub } from "@norish/shared-server/realtime/hub";
import { closeValkeyConnections } from "@norish/shared-server/valkey/client";
import { withTimeout } from "@norish/shared/lib/with-timeout";
import { stopTrpcWebSocket } from "@norish/trpc/server";

type ShutdownTask = {
  name: string;
  run: () => Promise<void>;
};

// Shutdown timeouts
const SHUTDOWN_TIMEOUT_MS = 30_000; // 30 seconds per operation
const FORCE_EXIT_TIMEOUT_MS = 60_000; // 60 seconds total before force exit
const SLOW_STEP_MS = 2_000; // a step this slow is named, so a slow shutdown says why

/**
 * Run a shutdown step under SHUTDOWN_TIMEOUT_MS. Rejects if the step doesn't
 * complete in time.
 */
async function runStep<T>(promise: Promise<T>, operation: string): Promise<T> {
  // Named while it is still running, so a step a supervisor kills says so too.
  const slow = setTimeout(() => log.warn({ operation }, "Shutdown step is slow"), SLOW_STEP_MS);

  try {
    return await withTimeout(() => promise, SHUTDOWN_TIMEOUT_MS, operation);
  } finally {
    clearTimeout(slow);
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
 * 2. WebSocket server - every socket closed with 1012 Service Restart while
 *    the HTTP close drains, since an upgraded socket would hold it open
 * 3. Internal listeners - CalDAV sync and Recipe Enrichment release their hub
 *    registrations
 * 4. BullMQ workers - complete current jobs, close queues
 * 5. Extra shutdown tasks - stop embedded child processes or other runtime helpers
 * 6. Realtime hub - end every live subscription, quit the subscriber connection
 * 7. Valkey connections - close after all consumers stopped
 */
async function performShutdown(
  server: Server,
  signal: string,
  shutdownTasks: ShutdownTask[]
): Promise<void> {
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
    // 1. Stop accepting new connections; the close completes once every
    //    connection has ended, and an upgraded socket counts as one.
    const httpClosed = closeHttpServer(server);

    httpClosed.catch(() => undefined);

    // 2. Close every WebSocket with 1012 so clients reconnect to the next
    //    process — and so live sockets do not hold the HTTP close open.
    try {
      await runStep(stopTrpcWebSocket(), "WebSocket server close");
    } catch (err) {
      log.warn({ err }, "WebSocket server close failed or timed out, continuing shutdown");
    }

    try {
      await runStep(httpClosed, "HTTP server close");
    } catch (err) {
      log.warn({ err }, "HTTP server close failed or timed out, continuing shutdown");
    }

    // 3. Stop CalDAV sync service (releases its hub registrations)
    await runStep(stopCaldavSync(), "Stop CalDAV sync");
    log.info("CalDAV sync service stopped");

    // 4. Stop listening for newly usable recipes
    await runStep(stopRecipeEnrichmentListener(), "Stop Recipe Enrichment listener");
    log.info("Recipe Enrichment listener stopped");

    // 5. Stop all BullMQ workers and close queues
    await runStep(stopWorkers(), "Stop workers");

    // 6. Stop extra runtime helpers that depend on HTTP/workers being drained first
    for (const task of shutdownTasks) {
      await runStep(task.run(), task.name);
      log.info(`${task.name} completed`);
    }

    // 7. Stop the realtime hub: every live subscription ends, the subscriber quits
    await runStep(stopRealtimeHub(), "Stop realtime hub");

    // 8. Close Valkey connections (after all consumers stopped)
    await runStep(closeValkeyConnections(), "Close Valkey");
    log.info("Valkey connections closed");

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
export function registerShutdownHandlers(server: Server, shutdownTasks: ShutdownTask[] = []): void {
  process.on("SIGTERM", () => performShutdown(server, "SIGTERM", shutdownTasks));
  process.on("SIGINT", () => performShutdown(server, "SIGINT", shutdownTasks));
}
