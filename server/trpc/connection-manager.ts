import type { WebSocket } from "ws";

import { on } from "node:events";

import superjson from "superjson";

import { getPublisherClient, createSubscriberClient } from "@/server/redis/client";
import { trpcLogger as log } from "@/server/logger";

// Map user IDs to their active WebSocket connections
const userConnections = new Map<string, Set<WebSocket>>();

export function registerConnection(userId: string, ws: WebSocket): void {
  if (!userConnections.has(userId)) {
    userConnections.set(userId, new Set());
  }

  userConnections.get(userId)!.add(ws);
}

export function unregisterConnection(userId: string, ws: WebSocket): void {
  const connections = userConnections.get(userId);
  if (connections) {
    connections.delete(ws);

    if (connections.size === 0) {
      userConnections.delete(userId);
    }

    log.trace({ userId, remaining: connections?.size ?? 0 }, "Unregistered WebSocket connection");
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

// Redis channel for cross-process connection invalidation
const INVALIDATION_CHANNEL = "norish:connection:invalidate";

type InvalidationMessage = {
  userId: string;
  reason: string;
};

export async function emitConnectionInvalidation(userId: string, reason: string): Promise<void> {
  const client = await getPublisherClient();
  const message: InvalidationMessage = { userId, reason };

  await client.publish(INVALIDATION_CHANNEL, superjson.stringify(message));
  log.debug({ userId, reason }, "Emitted connection invalidation");
}

export async function startInvalidationListener(): Promise<void> {
  const subscriber = await createSubscriberClient();
  await subscriber.subscribe(INVALIDATION_CHANNEL);

  log.info("Started connection invalidation listener");

  try {
    for await (const [channel, message] of on(subscriber, "message")) {
      if (channel === INVALIDATION_CHANNEL) {
        try {
          const { userId, reason } = superjson.parse<InvalidationMessage>(message);
          terminateUserConnections(userId, reason);
        } catch (err) {
          log.error({ err }, "Failed to parse invalidation message");
        }
      }
    }
  } catch (err) {
    log.error({ err }, "Connection invalidation listener error");
  }
}
