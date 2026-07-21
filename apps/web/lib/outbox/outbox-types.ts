/**
 * Shape of a persisted Outbox entry.
 *
 * An entry captures everything needed to replay a mutation that couldn't reach
 * the backend, once it becomes reachable again. Inputs are stored by IndexedDB
 * structured clone (not serialized), so `File`/`Blob` uploads survive intact.
 */

/** Terminal states Replay parks an entry in; pending entries carry none. */
export type OutboxEntryStatus = "pending" | "parked" | "conflicted";

/** Why an entry was parked — surfaced in the status UI (a later commit). */
export type ParkedReason =
  /** Server rejected it in a way that will re-fail forever (4xx, validation). */
  | "deterministic"
  /** First-writer-wins: the backend kept a concurrent write and dropped this. */
  | "conflict"
  /** Transient 5xx retried past its budget. */
  | "retries-exhausted"
  /** A create this entry depends on was itself parked (one broken story). */
  | "dependency";

export interface OutboxEntry {
  /** Auto-incremented FIFO sequence and IndexedDB key. Absent until appended. */
  seq: number;
  /** Stable entry id, for UI keys and diagnostics (not the entity id). */
  id: string;
  /** Cache/session owner this entry belongs to (per-user Replay, ADR-0005). */
  ownerId: string;
  /** tRPC procedure path, e.g. `"groceries.create"`. */
  path: string;
  /** The mutation input, stored by structured clone (may hold `File`/`Blob`). */
  input: unknown;
  /**
   * Client-minted id of the entity this mutation creates, when it is a create
   * (ADR-0003). Lets Replay park edits that depend on a parked create.
   */
  entityId: string | null;
  /** Preserved operationId so a replay is idempotent (ADR-0002). */
  operationId: string | null;
  /** Operation-scoped headers captured from the original request. */
  headers: Record<string, string>;
  /** ISO-8601 timestamp of the original (failed) attempt. */
  createdAt: string;
  /** Replay attempts so far (drives the bounded 5xx retry). */
  attempts: number;
  /** Current lifecycle state. */
  status: OutboxEntryStatus;
  /** Set when {@link status} is `parked` or `conflicted`. */
  parkedReason?: ParkedReason;
}

/** The fields provided when enqueuing; the store fills in the rest. */
export type NewOutboxEntry = Omit<OutboxEntry, "seq" | "attempts" | "status" | "createdAt"> & {
  createdAt?: string;
};
