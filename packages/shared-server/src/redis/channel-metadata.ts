/**
 * Channel Metadata Parsing
 *
 * Derives namespace, scope, event name, and scope identifiers from Redis channel strings.
 *
 * Channel format: `norish:{namespace}:{scope}:{...scopeIdentifiers}:{eventName}`
 *
 * Examples:
 *   norish:recipes:broadcast:created          → scope=broadcast, event=created
 *   norish:recipes:household:abc123:imported   → scope=household, householdKey=abc123, event=imported
 *   norish:recipes:user:user1:updated         → scope=user, userId=user1, event=updated
 *   norish:recipes:global:created             → scope=global, event=created
 */

import type { RealtimeEventScope } from "@norish/shared/contracts/realtime-envelope";

const CHANNEL_PREFIX = "norish";

const VALID_SCOPES = new Set<string>(["broadcast", "household", "user", "global"]);

/** Parsed metadata from a Redis channel string. */
export interface ChannelMetadata {
  namespace: string;
  scope: RealtimeEventScope;
  eventName: string;
}

/**
 * Parse a Redis channel string into structured metadata.
 *
 * @param channel - Full Redis channel string (e.g. "norish:recipes:household:abc:created")
 * @returns Parsed channel metadata, or `null` if the channel is not a valid Norish channel.
 */
export function parseChannelMetadata(channel: string): ChannelMetadata | null {
  const parts = channel.split(":");

  // Minimum: prefix:namespace:scope:event (4 parts for broadcast/global)
  if (parts.length < 4 || parts[0] !== CHANNEL_PREFIX) {
    return null;
  }

  const namespace = parts[1]!;
  const scope = parts[2]!;

  if (!VALID_SCOPES.has(scope)) {
    return null;
  }

  switch (scope) {
    case "broadcast":
    case "global": {
      // norish:namespace:scope:eventName
      if (parts.length < 4) return null;
      const eventName = parts.slice(3).join(":");

      return {
        namespace,
        scope: scope as RealtimeEventScope,
        eventName,
      };
    }

    case "household": {
      // norish:namespace:household:householdKey:eventName
      if (parts.length < 5) return null;
      const householdKey = parts[3]!;
      const eventName = parts.slice(4).join(":");

      return {
        namespace,
        scope: "household",
        eventName,
      };
    }

    case "user": {
      // norish:namespace:user:userId:eventName
      if (parts.length < 5) return null;
      const userId = parts[3]!;
      const eventName = parts.slice(4).join(":");

      return {
        namespace,
        scope: "user",
        eventName,
      };
    }

    default:
      return null;
  }
}
