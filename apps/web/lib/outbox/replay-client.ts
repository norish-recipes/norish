/**
 * Re-submits a stored Outbox entry through the live tRPC client.
 *
 * The replay preserves the entry's `operationId` so the server's idempotency
 * middleware makes a duplicate delivery a no-op (ADR-0002), and marks the
 * context so the Outbox link skips re-capturing it. The outcome is classified
 * for the Replay engine: a successful response is inspected for `stale: true`
 * (a Conflicted first-writer-wins loss), and thrown errors run through the
 * failure taxonomy.
 */
import type { ReplayOutcome } from "@/lib/outbox/error-classification";
import type { OutboxEntry } from "@/lib/outbox/outbox-types";
import { classifyReplayError, isStaleResult } from "@/lib/outbox/error-classification";
import { decodeOutboxInput } from "@/lib/outbox/input-codec";

/** Header stamped on replays so the Outbox link recognises and ignores them. */
export const OUTBOX_REPLAY_HEADER = "x-replay-origin";
export const OUTBOX_REPLAY_HEADER_VALUE = "web-outbox";

type TraversableClientNode = Record<string, unknown> | ((...args: never[]) => unknown);

/** The raw tRPC client proxy, traversed by path to reach `.mutate`. */
export type OutboxMutationClient = TraversableClientNode;

/** Context handed to a replayed mutation; the Outbox link keys off it. */
export interface OutboxReplayContext {
  operationId?: string;
  headers: Record<string, string>;
  skipOutboxCapture: true;
}

export function isOutboxReplayContext(context: unknown): boolean {
  if (!context || typeof context !== "object") {
    return false;
  }

  const ctx = context as { skipOutboxCapture?: unknown; headers?: Record<string, unknown> };

  return (
    ctx.skipOutboxCapture === true ||
    ctx.headers?.[OUTBOX_REPLAY_HEADER] === OUTBOX_REPLAY_HEADER_VALUE
  );
}

function createReplayContext(entry: OutboxEntry): OutboxReplayContext {
  return {
    ...(entry.operationId ? { operationId: entry.operationId } : {}),
    headers: { ...entry.headers, [OUTBOX_REPLAY_HEADER]: OUTBOX_REPLAY_HEADER_VALUE },
    skipOutboxCapture: true,
  };
}

function isTraversable(value: unknown): value is TraversableClientNode {
  return (typeof value === "object" && value !== null) || typeof value === "function";
}

function getMutate(client: OutboxMutationClient, path: string) {
  const procedure = path.split(".").reduce<unknown>((current, segment) => {
    return isTraversable(current) ? (current as Record<string, unknown>)[segment] : undefined;
  }, client);

  if (!isTraversable(procedure)) {
    return null;
  }

  const mutate = (procedure as { mutate?: unknown }).mutate;

  return typeof mutate === "function"
    ? (mutate as (input: unknown, opts: { context: OutboxReplayContext }) => Promise<unknown>)
    : null;
}

export async function replayOutboxEntry(
  client: OutboxMutationClient,
  entry: OutboxEntry
): Promise<ReplayOutcome> {
  const mutate = getMutate(client, entry.path);

  if (!mutate) {
    // The path no longer exists in the router — it can never succeed.
    return { kind: "deterministic" };
  }

  try {
    // Encoded inputs (FormData) are reconstructed immediately before transport.
    const result = await mutate(decodeOutboxInput(entry.input), {
      context: createReplayContext(entry),
    });

    return isStaleResult(result) ? { kind: "conflict" } : { kind: "success" };
  } catch (error) {
    return { kind: classifyReplayError(error) };
  }
}
