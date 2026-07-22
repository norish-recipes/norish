/**
 * Replay failure taxonomy (ADR-0004, and the design record's failure table).
 *
 * A replayed mutation can end five ways beyond plain success. Each maps to a
 * distinct Replay action, so classification must be exact:
 *
 *  - `unreachable`   — backend down: halt, keep the entry at the head, resume on
 *                      recovery. Nothing lost, nothing skipped.
 *  - `unauthorized`  — expired session: halt the whole queue ("sign in to sync")
 *                      so a dead cookie can't wreck it.
 *  - `ambiguous`     — a 5xx (server mid-restart): bounded retry with backoff,
 *                      then park.
 *  - `deterministic` — a 4xx / validation error that will re-fail forever: park
 *                      this one, but keep draining the rest.
 *  - `conflict`      — a *successful* response carrying `stale: true`: first
 *                      writer won, this write was dropped; park as Conflicted so
 *                      the loss is visible, never silent.
 */

import { isUnauthorizedTRPCError } from "@norish/shared-react/providers";
import { isBackendUnreachableError } from "@norish/shared/lib/trpc-errors";

export type ReplayFailureClass = "unreachable" | "unauthorized" | "ambiguous" | "deterministic";

export type ReplayOutcome =
  /** `result` carries the mutation response so Replay can read generic
   *  contracts off it (client-to-canonical id substitutions, ADR-0009). */
  { kind: "success"; result?: unknown } | { kind: "conflict" | ReplayFailureClass };

/**
 * The HTTP status a tRPC error carries, from `error.data.httpStatus` — the same
 * field `isBackendUnreachableError` keys off. Present on `TRPCClientError` and
 * on the plain error shapes used in tests.
 */
function httpStatusOf(error: unknown): number | null {
  const data = (error as { data?: { httpStatus?: unknown } } | null | undefined)?.data;

  return typeof data?.httpStatus === "number" ? data.httpStatus : null;
}

/**
 * Classify an error thrown while replaying a mutation. Order matters: a network
 * failure (no HTTP status) is unreachable; a 401 halts the queue; a 5xx is a
 * transient to retry; anything else with a definite status re-fails forever.
 */
export function classifyReplayError(error: unknown): ReplayFailureClass {
  if (isBackendUnreachableError(error)) {
    return "unreachable";
  }

  if (isUnauthorizedTRPCError(error)) {
    return "unauthorized";
  }

  const status = httpStatusOf(error);

  if (status !== null && status >= 500) {
    return "ambiguous";
  }

  return "deterministic";
}

/**
 * A conflict is not a transport error — it rides in on a *successful* response
 * as `{ stale: true }`. The server dropped a version-stale write (first writer
 * wins); Replay must inspect successful responses for it (ADR-0004).
 */
export function isStaleResult(result: unknown): boolean {
  return (
    typeof result === "object" && result !== null && (result as { stale?: unknown }).stale === true
  );
}
