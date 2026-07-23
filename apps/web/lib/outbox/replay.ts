/**
 * Outbox Replay engine.
 *
 * Drains the current owner's queue in strict FIFO order, applying the failure
 * taxonomy (see {@link ./error-classification}): success removes the entry, a
 * conflict/deterministic/exhausted failure parks it and keeps draining, and an
 * unreachable/unauthorized failure halts the queue with nothing skipped. A
 * parked create parks the edits that depend on it, so a broken chain is shown as
 * one story rather than a cascade of unrelated failures.
 *
 * Recovery owns single-flight execution, leader election, retry continuation,
 * and final cache reconciliation; this module is only the FIFO Replay pass.
 */

import type { ReplayOutcome } from "@/lib/outbox/error-classification";
import type { OutboxStore } from "@/lib/outbox/outbox-store";
import type { OutboxEntry } from "@/lib/outbox/outbox-types";

/** Attempts a 5xx entry gets before it is parked as retries-exhausted. */
export const MAX_AMBIGUOUS_ATTEMPTS = 3;

const RETRY_BASE_MS = 2_000;
const RETRY_MAX_MS = 30_000;

export function retryDelayMs(attempts: number): number {
  return Math.min(RETRY_BASE_MS * 2 ** Math.max(0, attempts - 1), RETRY_MAX_MS);
}

export type ReplayHaltReason = "unreachable" | "unauthorized" | "retry";

export interface ReplayPassResult {
  removed: number;
  parked: number;
  /** Pending entries still queued for this owner after the pass. */
  remaining: number;
  /** Why the pass stopped early, or null if it drained/parked everything. */
  halted: ReplayHaltReason | null;
  /** When `halted === "retry"`, how long to wait before the next pass. */
  retryAfterMs: number | null;
}

export type ReplaySubmit = (entry: OutboxEntry) => Promise<ReplayOutcome>;

/**
 * Whether `input` references any of the given (parked) entity ids. Entity ids
 * are UUIDs, so a plain deep string-equality scan is exact. `Blob`/`File` values
 * are skipped — they hold no ids and aren't worth walking.
 */
export function referencesParkedEntity(input: unknown, parkedEntityIds: Set<string>): boolean {
  if (parkedEntityIds.size === 0) {
    return false;
  }

  const seen = new Set<object>();
  const stack: unknown[] = [input];

  while (stack.length > 0) {
    const value = stack.pop();

    if (typeof value === "string") {
      if (parkedEntityIds.has(value)) {
        return true;
      }

      continue;
    }

    if (!value || typeof value !== "object" || seen.has(value)) {
      continue;
    }

    if (typeof Blob !== "undefined" && value instanceof Blob) {
      continue;
    }

    seen.add(value);

    if (Array.isArray(value)) {
      stack.push(...value);
    } else {
      stack.push(...Object.values(value as Record<string, unknown>));
    }
  }

  return false;
}

/** Run one FIFO drain pass over an owner's pending entries. */
export async function runReplayPass({
  store,
  submit,
  ownerId,
}: {
  store: OutboxStore;
  submit: ReplaySubmit;
  ownerId: string;
}): Promise<ReplayPassResult> {
  const parkedEntityIds = new Set<string>();

  // Seed from already-parked entries so a pending edit behind a create parked in
  // an earlier pass parks with it too.
  for (const entry of await store.forOwner(ownerId)) {
    if (entry.status !== "pending" && entry.entityId) {
      parkedEntityIds.add(entry.entityId);
    }
  }

  let removed = 0;
  let parked = 0;

  const finish = async (
    halted: ReplayHaltReason | null,
    retryAfterMs: number | null
  ): Promise<ReplayPassResult> => {
    const remaining = (await store.forOwner(ownerId, "pending")).length;

    return { removed, parked, remaining, halted, retryAfterMs };
  };

  const parkWith = async (entry: OutboxEntry, reason: Parameters<OutboxStore["park"]>[1]) => {
    await store.park(entry.seq, reason);

    if (entry.entityId) {
      parkedEntityIds.add(entry.entityId);
    }

    parked += 1;
  };

  for (const entry of await store.forOwner(ownerId, "pending")) {
    if (referencesParkedEntity(entry.input, parkedEntityIds)) {
      await parkWith(entry, "dependency");

      continue;
    }

    const outcome = await submit(entry);

    switch (outcome.kind) {
      case "success":
        await store.remove(entry.seq);
        removed += 1;
        break;

      case "conflict":
        await parkWith(entry, "conflict");
        break;

      case "deterministic":
        await parkWith(entry, "deterministic");
        break;

      case "unauthorized":
        return finish("unauthorized", null);

      case "unreachable":
        return finish("unreachable", null);

      case "ambiguous": {
        const attempts = entry.attempts + 1;

        if (attempts >= MAX_AMBIGUOUS_ATTEMPTS) {
          await parkWith(entry, "retries-exhausted");

          break;
        }

        await store.update(entry.seq, { attempts });

        return finish("retry", retryDelayMs(attempts));
      }
    }
  }

  return finish(null, null);
}
