/**
 * Realtime Event Envelope
 *
 * The one wire format for a realtime event: transport metadata around a domain
 * payload. Every publish produces one, every subscription yields one (or a
 * Cursor Mark), and every client handler receives `(payload, meta)`.
 *
 * Client-safe: import from `@norish/shared/contracts/realtime/envelope`.
 */

/** Branded type for operation IDs to prevent accidental string misuse. */
export type OperationId = string & { readonly __brand: "OperationId" };

/** Context carrying the optional client-generated operationId. */
export interface OperationContext {
  operationId?: OperationId;
}

/**
 * Scopes a channel can carry. `policy` is a publish-time choice that resolves
 * to one of these; it is never a channel segment.
 */
export type RealtimeEventScope = "household" | "user" | "broadcast" | "internal";

export const REALTIME_EVENT_SCOPES: readonly RealtimeEventScope[] = [
  "household",
  "user",
  "broadcast",
  "internal",
];

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
  /**
   * Resume Buffer stream id (`<ms>-<seq>`) for buffered scopes; a UUID for
   * `internal` events, which are neither buffered nor resumable.
   */
  eventId: string;
  /** Client-generated operation identifier, when the publish ran inside an operation context. */
  operationId?: OperationId;
  /** Logical event name (e.g. "created", "imported"). */
  eventName: string;
  /** Catalogue namespace (e.g. "recipe", "grocery"). */
  namespace: string;
  /** Routing scope of the channel the event went out on. */
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
 */
export interface RealtimeEventEnvelope<P = unknown> {
  meta: RealtimeEventMeta;
  payload: P;
}

/**
 * A cursor delivered without an event. Every subscription yields one first so
 * that a subscription that never saw an event is resumable too.
 */
export interface RealtimeCursorMark {
  mark: "cursor";
}

export const CURSOR_MARK: RealtimeCursorMark = Object.freeze({ mark: "cursor" });

/**
 * The message of the `PRECONDITION_FAILED` error a subscription ends with when
 * it cannot continue in order: queue overflow, a Redis reconnect, or a cursor
 * it cannot resume from. The client's one reaction is to refetch and resubscribe.
 */
export const REALTIME_LAGGED = "REALTIME_LAGGED";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object";
}

function isRealtimeEventScope(value: unknown): value is RealtimeEventScope {
  return typeof value === "string" && (REALTIME_EVENT_SCOPES as readonly string[]).includes(value);
}

/** Determine whether a value is a realtime event envelope. */
export function isEventEnvelope<P = unknown>(data: unknown): data is RealtimeEventEnvelope<P> {
  if (!isRecord(data)) return false;

  if (!("meta" in data && "payload" in data)) return false;

  const meta = data.meta;

  if (!isRecord(meta)) return false;

  return (
    meta.version === ENVELOPE_VERSION &&
    typeof meta.eventId === "string" &&
    typeof meta.eventName === "string" &&
    typeof meta.namespace === "string" &&
    isRealtimeEventScope(meta.scope) &&
    typeof meta.channel === "string" &&
    typeof meta.occurredAt === "string" &&
    (meta.operationId === undefined ||
      (typeof meta.operationId === "string" && meta.operationId.length > 0))
  );
}

/**
 * Assert that a value is a realtime event envelope. Anything else reaching a
 * subscription consumer is a programming error, not a case to tolerate.
 */
export function assertEventEnvelope<P = unknown>(
  data: unknown,
  message = "Expected realtime event envelope"
): asserts data is RealtimeEventEnvelope<P> {
  if (!isEventEnvelope<P>(data)) {
    throw new TypeError(message);
  }
}

/** Determine whether a subscription item is a Cursor Mark rather than an event. */
export function isCursorMark(data: unknown): data is RealtimeCursorMark {
  return isRecord(data) && data.mark === "cursor" && !("meta" in data) && !("payload" in data);
}
