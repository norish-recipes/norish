/**
 * Realtime Catalogue
 *
 * A catalogue declares every realtime event of one domain exactly once: its
 * name, its Scope and its zod payload schema. Server publishers, tRPC
 * subscription procedures and client handler types all derive from it; there
 * is no second place to declare an event.
 *
 * Client-safe: import from `@norish/shared/contracts/realtime/catalogue`.
 */

import type { z } from "zod";

/**
 * Where an event goes. `policy` is resolved at publish time to `household`,
 * `broadcast` or `user` from the resource's view policy; `internal` events are
 * server-to-server only and never reach a client.
 */
export type RealtimeScope = "household" | "user" | "policy" | "broadcast" | "internal";

export interface RealtimeEventSpec<S extends RealtimeScope = RealtimeScope, P = unknown> {
  scope: S;
  payload: z.ZodType<P>;
}

export interface RealtimeCatalogue<
  E extends Record<string, RealtimeEventSpec> = Record<string, RealtimeEventSpec>,
> {
  namespace: string;
  events: E;
}

export function defineRealtimeCatalogue<E extends Record<string, RealtimeEventSpec>>(
  namespace: string,
  events: E
): RealtimeCatalogue<E> {
  if (!/^[a-z][a-z0-9-]*$/.test(namespace)) {
    throw new Error(`Invalid realtime namespace "${namespace}"`);
  }

  for (const name of Object.keys(events)) {
    if (name.length === 0 || name.includes(":")) {
      throw new Error(`Invalid realtime event name "${name}" in namespace "${namespace}"`);
    }
  }

  return { namespace, events };
}

export type EventName<C extends RealtimeCatalogue> = keyof C["events"] & string;

export type ScopeOf<C extends RealtimeCatalogue, E extends EventName<C>> = C["events"][E]["scope"];

export type PayloadOf<C extends RealtimeCatalogue, E extends EventName<C>> = z.infer<
  C["events"][E]["payload"]
>;

/** Event names a client may subscribe to: everything that is not `internal`. */
export type ClientEventName<C extends RealtimeCatalogue> = {
  [E in EventName<C>]: ScopeOf<C, E> extends "internal" ? never : E;
}[EventName<C>];
