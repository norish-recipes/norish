/**
 * Realtime Domain
 *
 * The server side of a Realtime Catalogue: `publish` validates the payload
 * against the catalogue, stamps the operation id, resolves the channel from
 * the event's Scope and its target, and runs the Resume script (or a bare
 * `PUBLISH` for `internal` events). Domains are stateless: each
 * `realtime/<domain>.ts` is one `defineRealtimeDomain(catalogue)` line.
 *
 * `publish` never rejects in production: the mutation already committed and
 * its announcement must not fail it. A payload that fails its schema throws
 * outside production so a test catches the rot; a Redis failure is always
 * logged and dropped.
 */

import { randomUUID } from "node:crypto";
import superjson from "superjson";

import type { PermissionLevel } from "@norish/config/zod/server-config";
import type {
  ClientEventName,
  EventName,
  PayloadOf,
  RealtimeCatalogue,
  RealtimeScope,
  ScopeOf,
} from "@norish/shared/contracts/realtime/catalogue";
import type {
  RealtimeEventEnvelope,
  RealtimeEventMeta,
  RealtimeEventScope,
} from "@norish/shared/contracts/realtime/envelope";
import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { getCurrentOperationId } from "@norish/shared-server/lib/operation-context";
import { createLogger } from "@norish/shared-server/logger";
import { getPublisherClient } from "@norish/shared-server/redis/client";
import { ENVELOPE_VERSION } from "@norish/shared/contracts/realtime/envelope";

import { buildChannel, streamKeyFor } from "./channel";
import { registerRealtimePublish, RESUME_MAXLEN, RESUME_TTL_SECONDS } from "./resume";

const log = createLogger("realtime");

/** The placeholder the Lua script replaces with the stream entry id. */
export const EVENT_ID_PLACEHOLDER = "$ID$";

export type PolicyTarget = { viewPolicy: PermissionLevel; householdKey: string; userId: string };

export type TargetFor<S extends RealtimeScope> = S extends "household"
  ? { householdKey: string }
  : S extends "user"
    ? { userId: string }
    : S extends "policy"
      ? PolicyTarget
      : undefined;

export interface RealtimeDomain<C extends RealtimeCatalogue> {
  catalogue: C;
  publish<E extends EventName<C>>(
    event: E,
    payload: PayloadOf<C, E>,
    target: TargetFor<ScopeOf<C, E>>
  ): Promise<void>;
  channel<E extends EventName<C>>(event: E, target: TargetFor<ScopeOf<C, E>>): string;
  /** The channels a subscriber with this identity listens on; `policy` → household, broadcast, user. */
  channelsFor<E extends ClientEventName<C>>(
    event: E,
    identity: { userId: string; householdKey: string }
  ): string[];
}

export class RealtimePayloadError extends Error {
  override readonly name = "RealtimePayloadError";
}

type ResolvedChannel = { scope: RealtimeEventScope; channel: string };

function resolveChannel(
  namespace: string,
  event: string,
  scope: RealtimeScope,
  target: unknown
): ResolvedChannel {
  switch (scope) {
    case "household": {
      const { householdKey } = target as { householdKey: string };

      return { scope, channel: buildChannel({ namespace, scope, id: householdKey, event }) };
    }
    case "user": {
      const { userId } = target as { userId: string };

      return { scope, channel: buildChannel({ namespace, scope, id: userId, event }) };
    }
    case "policy": {
      const { viewPolicy, householdKey, userId } = target as PolicyTarget;

      switch (viewPolicy) {
        case "everyone":
          return {
            scope: "broadcast",
            channel: buildChannel({ namespace, scope: "broadcast", event }),
          };
        case "household":
          return {
            scope: "household",
            channel: buildChannel({ namespace, scope: "household", id: householdKey, event }),
          };
        case "owner":
          return {
            scope: "user",
            channel: buildChannel({ namespace, scope: "user", id: userId, event }),
          };
      }
      throw new Error(`Unknown view policy "${String(viewPolicy)}" for ${namespace}:${event}`);
    }
    case "broadcast":
    case "internal":
      return { scope, channel: buildChannel({ namespace, scope, event }) };
  }
}

export function defineRealtimeDomain<C extends RealtimeCatalogue>(catalogue: C): RealtimeDomain<C> {
  const { namespace } = catalogue;

  function specFor(event: string) {
    const spec = catalogue.events[event];

    if (!spec) {
      throw new Error(`Unknown realtime event "${event}" in namespace "${namespace}"`);
    }

    return spec;
  }

  function channel(event: string, target: unknown): string {
    return resolveChannel(namespace, event, specFor(event).scope, target).channel;
  }

  function channelsFor(
    event: string,
    identity: { userId: string; householdKey: string }
  ): string[] {
    const { scope } = specFor(event);

    switch (scope) {
      case "household":
        return [buildChannel({ namespace, scope, id: identity.householdKey, event })];
      case "user":
        return [buildChannel({ namespace, scope, id: identity.userId, event })];
      case "broadcast":
        return [buildChannel({ namespace, scope, event })];
      case "policy":
        return [
          buildChannel({ namespace, scope: "household", id: identity.householdKey, event }),
          buildChannel({ namespace, scope: "broadcast", event }),
          buildChannel({ namespace, scope: "user", id: identity.userId, event }),
        ];
      case "internal":
        throw new Error(`Internal event "${namespace}:${event}" is not subscribable`);
    }
  }

  async function publish(event: string, payload: unknown, target: unknown): Promise<void> {
    const spec = specFor(event);
    const parsed = spec.payload.safeParse(payload);

    if (!parsed.success) {
      const issues = parsed.error.issues;

      if (SERVER_CONFIG.NODE_ENV !== "production") {
        throw new RealtimePayloadError(
          `Realtime payload for ${namespace}:${event} failed its schema: ${JSON.stringify(issues)}`
        );
      }

      log.error({ namespace, event, issues }, "Dropped realtime publish failing its schema");

      return;
    }

    const resolved = resolveChannel(namespace, event, spec.scope, target);
    const operationId = getCurrentOperationId();
    const meta: RealtimeEventMeta = {
      version: ENVELOPE_VERSION,
      eventId: resolved.scope === "internal" ? randomUUID() : EVENT_ID_PLACEHOLDER,
      ...(operationId ? { operationId } : {}),
      eventName: event,
      namespace,
      scope: resolved.scope,
      channel: resolved.channel,
      occurredAt: new Date().toISOString(),
    };
    const envelope: RealtimeEventEnvelope = { meta, payload: parsed.data };
    const message = superjson.stringify(envelope);

    try {
      const client = await getPublisherClient();

      if (resolved.scope === "internal") {
        await client.publish(resolved.channel, message);
      } else {
        registerRealtimePublish(client);
        await client.realtimePublish(
          streamKeyFor(resolved.channel),
          resolved.channel,
          message,
          RESUME_MAXLEN,
          RESUME_TTL_SECONDS
        );
      }

      log.debug({ channel: resolved.channel, operationId }, "Published realtime event");
    } catch (err) {
      log.error({ err, channel: resolved.channel }, "Failed to publish realtime event");
    }
  }

  return {
    catalogue,
    publish: publish as RealtimeDomain<C>["publish"],
    channel: channel as RealtimeDomain<C>["channel"],
    channelsFor: channelsFor as RealtimeDomain<C>["channelsFor"],
  };
}
