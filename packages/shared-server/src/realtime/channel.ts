/**
 * Channel codec
 *
 * `norish:{namespace}:{scope}:{id?}:{event}` — the one place a channel string
 * is built or taken apart. `household` and `user` channels carry an id
 * segment; `broadcast` and `internal` do not. The Resume Buffer stream for a
 * channel is the channel with `norish:` replaced by `norish:stream:`.
 */

import type { RealtimeEventScope } from "@norish/shared/contracts/realtime/envelope";
import { REALTIME_EVENT_SCOPES } from "@norish/shared/contracts/realtime/envelope";

export const CHANNEL_PREFIX = "norish";
export const STREAM_PREFIX = `${CHANNEL_PREFIX}:stream`;

export interface ChannelParts {
  namespace: string;
  scope: RealtimeEventScope;
  /** Household key or user id; absent for `broadcast` and `internal`. */
  id?: string;
  event: string;
}

function scopeHasId(scope: RealtimeEventScope): boolean {
  return scope === "household" || scope === "user";
}

export function buildChannel(parts: ChannelParts): string {
  const { namespace, scope, id, event } = parts;

  if (scopeHasId(scope)) {
    if (!id) {
      throw new Error(`A ${scope} channel needs an id (${namespace}:${event})`);
    }

    return `${CHANNEL_PREFIX}:${namespace}:${scope}:${id}:${event}`;
  }

  return `${CHANNEL_PREFIX}:${namespace}:${scope}:${event}`;
}

/**
 * Parse a channel string. Returns `null` for anything that is not a Norish
 * channel, including the retired `global` scope.
 */
export function parseChannel(channel: string): ChannelParts | null {
  const parts = channel.split(":");

  if (parts.length < 4 || parts[0] !== CHANNEL_PREFIX) {
    return null;
  }

  const namespace = parts[1]!;
  const scope = parts[2]!;

  if (!namespace || !(REALTIME_EVENT_SCOPES as readonly string[]).includes(scope)) {
    return null;
  }

  const typedScope = scope as RealtimeEventScope;

  if (scopeHasId(typedScope)) {
    if (parts.length < 5) return null;

    const id = parts[3]!;
    const event = parts.slice(4).join(":");

    if (!id || !event) return null;

    return { namespace, scope: typedScope, id, event };
  }

  const event = parts.slice(3).join(":");

  if (!event) return null;

  return { namespace, scope: typedScope, event };
}

/** The Resume Buffer stream key for a channel. */
export function streamKeyFor(channel: string): string {
  if (!channel.startsWith(`${CHANNEL_PREFIX}:`)) {
    throw new Error(`Not a Norish channel: ${channel}`);
  }

  return `${STREAM_PREFIX}:${channel.slice(CHANNEL_PREFIX.length + 1)}`;
}
