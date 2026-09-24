import type { WebSocket } from "ws";

import { trpcLogger as log } from "@norish/shared-server/logger";
import { connection, emitConnectionInvalidation } from "@norish/shared-server/realtime/connection";
import { getRealtimeHub } from "@norish/shared-server/realtime/hub";

// Use globalThis to survive HMR in development
const globalForConnectionManager = globalThis as unknown as {
  userConnections: Map<string, Set<WebSocket>> | undefined;
};

// Map user IDs to their active WebSocket connections
const userConnections =
  globalForConnectionManager.userConnections ?? new Map<string, Set<WebSocket>>();

globalForConnectionManager.userConnections = userConnections;

export function registerConnection(userId: string, ws: WebSocket): void {
  if (!userConnections.has(userId)) {
    userConnections.set(userId, new Set());
  }

  userConnections.get(userId)!.add(ws);
}

export function unregisterConnection(userId: string, ws: WebSocket): void {
  const connections = userConnections.get(userId);

  if (!connections) return;

  connections.delete(ws);

  if (connections.size === 0) {
    userConnections.delete(userId);
  }

  log.trace({ userId, remaining: connections.size }, "Unregistered WebSocket connection");
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

/** The channel every process listens on for Scope Changes (ADR-0033). */
export const CONNECTION_INVALIDATION_CHANNEL = connection.channel("invalidate", undefined);

/**
 * Listen for `connection.invalidate` on the hub and close the named user's
 * sockets. Returns the function that releases the registration. The hub must
 * be started first.
 */
export function startConnectionInvalidation(): () => void {
  const off = getRealtimeHub().on(CONNECTION_INVALIDATION_CHANNEL, (envelope) => {
    const parsed = connection.catalogue.events.invalidate.payload.safeParse(envelope.payload);

    if (!parsed.success) {
      log.error({ issues: parsed.error.issues }, "Dropped malformed connection invalidation");

      return;
    }

    terminateUserConnections(parsed.data.userId, parsed.data.reason);
  });

  log.info("Started connection invalidation listener");

  return () => {
    off();
    log.info("Stopped connection invalidation listener");
  };
}
