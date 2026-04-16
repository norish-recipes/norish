/**
 * Shape of a persisted outbox item.
 *
 * Stores the exact information needed to replay a failed tRPC mutation
 * request once the backend becomes reachable again.
 */
export type OutboxRequestMetadata = {
  /** Preserved operation ID for idempotent replay correlation. */
  operationId: string | null;
  /** Operation-scoped headers generated during the original request. */
  headers: Record<string, string>;
};

export type OutboxItem = {
  /** Unique identifier for the outbox entry. */
  id: string;
  /** tRPC procedure path (e.g. "recipes.update"). */
  path: string;
  /** SuperJSON-serialized input payload. */
  input: string;
  /** Replay-relevant request metadata captured from the original mutation. */
  request: OutboxRequestMetadata;
  /** ISO-8601 timestamp of when the mutation was originally attempted. */
  createdAt: string;
  /** Number of replay attempts so far. */
  attempts: number;
  /** ISO-8601 timestamp of the earliest next retry. null = eligible now. */
  nextRetryAt: string | null;
};
