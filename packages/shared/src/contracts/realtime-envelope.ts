/**
 * Realtime Event Envelope Types
 *
 * Transport-level metadata types for Redis/tRPC realtime events.
 * These enable offline reconciliation by providing:
 * - Client-generated `operationId` for mutation correlation
 * - Server-generated `eventId` for unique event identification
 * - Channel metadata for routing context
 *
 * These types are client-safe and can be imported from `@norish/shared/contracts`.
 */

/** Branded type for operation IDs to prevent accidental string misuse. */
export type OperationId = string & { readonly __brand: "OperationId" };

/** Context carrying the optional client-generated operationId. */
export interface OperationContext {
  operationId?: OperationId;
}

/** Scopes that a realtime event can be published to. */
export type RealtimeEventScope = "broadcast" | "household" | "user" | "global";

/** Current envelope metadata version. */
export const ENVELOPE_VERSION = 1 as const;

/**
 * Transport metadata for a realtime event.
 *
 * Append-only and non-authoritative for business ordering.
 * Used for reconciliation and traceability, not domain versioning.
 */
export interface RealtimeEventMeta {
  /** Envelope schema version for future evolution. */
  version: typeof ENVELOPE_VERSION;
  /** Server-generated unique event identifier. */
  eventId: string;
  /** Client-generated operation identifier (when the event originated from a correlated action). */
  operationId?: OperationId;
  /** Logical event name (e.g. "created", "imported"). */
  eventName: string;
  /** Emitter namespace (e.g. "recipes", "groceries"). */
  namespace: string;
  /** Routing scope. */
  scope: RealtimeEventScope;
  /** Full resolved Redis channel string. */
  channel: string;
  /** ISO 8601 timestamp of when the event occurred. */
  occurredAt: string;
}

/**
 * Standard realtime event envelope.
 *
 * Wraps a domain payload with transport metadata.
 * The `payload` field is the existing domain event body, unchanged.
 */
export interface RealtimeEventEnvelope<T = unknown> {
  meta: RealtimeEventMeta;
  payload: T;
}

/**
 * Normalized subscription data as seen by client-side handlers.
 *
 * When consuming data through the compatibility path, `meta` is `null`.
 * When consuming through the envelope-aware path, `meta` is present.
 */
export interface NormalizedSubscriptionData<T = unknown> {
  meta: RealtimeEventMeta | null;
  payload: T;
}
