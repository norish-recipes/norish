import { on } from "node:events";
import type Redis from "ioredis";
import type { WebSocket } from "ws";
import superjson from "superjson";

import type { ConnectionInvalidationMessage } from "@norish/shared-server/realtime/connection-invalidation";
import { trpcLogger as log } from "@norish/shared-server/logger";
import {
  CONNECTION_INVALIDATION_CHANNEL,
  emitConnectionInvalidation,
} from "@norish/shared-server/realtime/connection-invalidation";
import { createSubscriberClient } from "@norish/shared-server/redis/client";
import { closeMultiplexer } from "@norish/shared-server/redis/subscription-multiplexer";

// Use globalThis to survive HMR in development
const globalForConnectionManager = globalThis as unknown as {
  userConnections: Map<string, Set<WebSocket>> | undefined;
  wsConnectionIds: WeakMap<WebSocket, string> | undefined;
  invalidationAbortController: AbortController | null;
  invalidationSubscriber: Redis | null;
};

// Map user IDs to their active WebSocket connections
const userConnections =
  globalForConnectionManager.userConnections ?? new Map<string, Set<WebSocket>>();

// Map WebSocket to connectionId for multiplexer cleanup
const wsConnectionIds =
  globalForConnectionManager.wsConnectionIds ?? new WeakMap<WebSocket, string>();

globalForConnectionManager.userConnections = userConnections;
globalForConnectionManager.wsConnectionIds = wsConnectionIds;

// Track invalidation listener state for cleanup
let invalidationAbortController = globalForConnectionManager.invalidationAbortController ?? null;
let invalidationSubscriber = globalForConnectionManager.invalidationSubscriber ?? null;

export function registerConnection(userId: string, ws: WebSocket, connectionId?: string): void {
  if (!userConnections.has(userId)) {
    userConnections.set(userId, new Set());
  }

  userConnections.get(userId)!.add(ws);

  // Store connectionId for multiplexer cleanup on disconnect
  if (connectionId) {
    wsConnectionIds.set(ws, connectionId);
  }
}

export async function unregisterConnection(userId: string, ws: WebSocket): Promise<void> {
  const connections = userConnections.get(userId);

  if (connections) {
    connections.delete(ws);

    if (connections.size === 0) {
      userConnections.delete(userId);
    }

    log.trace({ userId, remaining: connections?.size ?? 0 }, "Unregistered WebSocket connection");
  }

  // Cleanup the multiplexer for this connection
  const connectionId = wsConnectionIds.get(ws);

  if (connectionId) {
    await closeMultiplexer(connectionId);
    // WeakMap auto-cleans when ws is GC'd, no need to delete
  }
}

export function terminateUserConnections(userId: string, reason: string): void {
  const connections = userConnections.get(userId);

  if (connections) {
    log.info({ userId, count: connections.size, reason }, "Terminating user WebSocket connections");
    for (const ws of connections) {
      // Close with code 4000 (custom application code) - client will auto-reconnect
      ws.close(4000, reason);
    }

    userConnections.delete(userId);
  }
}

export { emitConnectionInvalidation };

export async function startInvalidationListener(): Promise<void> {
  // Prevent duplicate listeners
  if (invalidationAbortController) {
    log.warn("Invalidation listener already running");

    return;
  }

  invalidationAbortController = new AbortController();
  globalForConnectionManager.invalidationAbortController = invalidationAbortController;
  const signal = invalidationAbortController.signal;

  const subscriber = await createSubscriberClient();

  invalidationSubscriber = subscriber;
  globalForConnectionManager.invalidationSubscriber = subscriber;

  await subscriber.subscribe(CONNECTION_INVALIDATION_CHANNEL);

  log.info("Started connection invalidation listener");

  try {
    for await (const [channel, message] of on(subscriber, "message", { signal })) {
      if (channel === CONNECTION_INVALIDATION_CHANNEL) {
        try {
          const { userId, reason } = superjson.parse<ConnectionInvalidationMessage>(message);

          terminateUserConnections(userId, reason);
        } catch (err) {
          log.error({ err }, "Failed to parse invalidation message");
        }
      }
    }
  } catch (err) {
    // AbortError is expected when signal is aborted - ignore it
    if ((err as Error).name !== "AbortError") {
      log.error({ err }, "Connection invalidation listener error");
    }
  } finally {
    // Always cleanup Redis subscriber
    try {
      await subscriber.unsubscribe(INVALIDATION_CHANNEL);
      await subscriber.quit();
    } catch (err) {
      log.debug({ err }, "Error during invalidation listener cleanup");
    }

    if (invalidationSubscriber === subscriber) {
      invalidationSubscriber = null;
      globalForConnectionManager.invalidationSubscriber = null;
    }

    invalidationAbortController = null;
    globalForConnectionManager.invalidationAbortController = null;
    log.info("Stopped connection invalidation listener");
  }
}

/**
 * Stop the invalidation listener.
 * Call during server shutdown.
 */
export async function stopInvalidationListener(): Promise<void> {
  if (invalidationAbortController) {
    log.info("Stopping connection invalidation listener...");
    invalidationAbortController.abort();
    // Give the listener time to cleanup
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
