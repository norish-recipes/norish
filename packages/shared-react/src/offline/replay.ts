/**
 * Outbox Replay engine.
 *
 * Drains the current owner's queue in strict FIFO order, applying the failure
 * taxonomy (see {@link ./error-classification}): success removes the entry, a
 * conflict/deterministic/exhausted failure parks it and keeps draining, and an
 * unreachable/unauthorized failure halts the queue with nothing skipped. A
 * parked create parks the edits that depend on it, so a broken chain is shown as
 * one story rather than a cascade of unrelated failures. A Conflicted entry parks none: its
 * entity exists, and the server's version checks decide each later write.
 *
 * Recovery owns single-flight execution, leader election, retry continuation,
 * and final cache reconciliation; this module is only the FIFO Replay pass.
 */

import type { ReplayOutcome } from "./error-classification";
import type { OutboxStore } from "./outbox-store";
import type { OutboxEntry, ParkedReason } from "./outbox-types";
import { parkedPatch } from "./outbox-store";
import { isAccountScoped, isUncaptured } from "./uncaptured";

/** Attempts a 5xx entry gets before it is parked as retries-exhausted. */
export const MAX_AMBIGUOUS_ATTEMPTS = 3;

const RETRY_BASE_MS = 2_000;
const RETRY_MAX_MS = 30_000;

export function retryDelayMs(attempts: number): number {
  return Math.min(RETRY_BASE_MS * 2 ** Math.max(0, attempts - 1), RETRY_MAX_MS);
}

type ReplayHaltReason = "unreachable" | "unauthorized" | "retry";

interface ReplayPassResult {
  removed: number;
  parked: number;
  /** The entries this pass parked as Conflicted: the server kept a newer write. */
  conflicted: OutboxEntry[];
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
  householdId,
}: {
  store: OutboxStore;
  submit: ReplaySubmit;
  ownerId: string;
  /** The household the server has the account in now; an entry made for another can't apply. */
  householdId: string;
}): Promise<ReplayPassResult> {
  const parkedEntityIds = new Set<string>();

  // An entry stored before its procedure was excluded is dropped unsent, whatever its status.
  for (const entry of await store.forOwner(ownerId)) {
    if (isUncaptured(entry.path)) await store.remove(entry.seq);
  }

  // Seed from parked entries, so an edit behind a create parked earlier parks too. A Conflicted
  // entity exists on the server: it seeds none, and a write once parked behind it is released.
  for (const entry of await store.forOwner(ownerId)) {
    if (entry.status === "pending" || entry.status === "conflicted") continue;

    if (
      entry.parkedReason === "dependency" &&
      !referencesParkedEntity(entry.input, parkedEntityIds)
    ) {
      await store.change(entry.seq, (stored) =>
        stored.status === "parked" && stored.parkedReason === "dependency"
          ? { ...stored, status: "pending", parkedReason: undefined }
          : undefined
      );
      continue;
    }

    if (entry.entityId) parkedEntityIds.add(entry.entityId);
  }

  let removed = 0;
  let parked = 0;
  const conflicted: OutboxEntry[] = [];

  const finish = async (
    halted: ReplayHaltReason | null,
    retryAfterMs: number | null
  ): Promise<ReplayPassResult> => {
    const remaining = (await store.forOwner(ownerId, "pending")).length;

    return { removed, parked, conflicted, remaining, halted, retryAfterMs };
  };

  const countParked = (entry: OutboxEntry, reason: ParkedReason) => {
    if (entry.entityId && reason !== "conflict") {
      parkedEntityIds.add(entry.entityId);
    }

    parked += 1;
  };

  for (const entry of await store.forOwner(ownerId, "pending")) {
    // An early exit only: the server refuses one made for another household when it is sent.
    if (!isAccountScoped(entry.path) && entry.householdId !== householdId) {
      await store.park(entry.seq, "other-household");
      countParked(entry, "other-household");

      continue;
    }

    if (referencesParkedEntity(entry.input, parkedEntityIds)) {
      await store.park(entry.seq, "dependency");
      countParked(entry, "dependency");

      continue;
    }

    // Marked before it is sent, and sent as stored then: a save replaced it until this point.
    const claimed = await store.change(entry.seq, (stored) =>
      stored.status === "pending" ? { ...stored, sending: store.process } : undefined
    );

    if (!claimed) continue;
    const outcome = await submit(claimed);
    // Acts only on the entry as sent: a save that replaced it meanwhile (from a context that may
    // count this mark stale) stays pending, unmarked, for a later pass. Null removes the entry.
    const settle = async (patch: Partial<OutboxEntry> | null) => {
      const written = await store.change(entry.seq, (stored) =>
        stored.operationId !== claimed.operationId
          ? stored.sending === store.process
            ? { ...stored, sending: undefined }
            : undefined
          : patch && { ...stored, ...patch, sending: undefined }
      );

      return written === null || (!!written && written.operationId === claimed.operationId);
    };
    const park = async (reason: ParkedReason) => {
      const parks = await settle(parkedPatch(reason));

      if (parks) countParked(entry, reason);

      return parks;
    };

    switch (outcome.kind) {
      case "success":
        if (await settle(null)) removed += 1;
        break;

      case "conflict":
        if (await park("conflict")) conflicted.push(claimed);
        break;

      case "deterministic":
      case "other-household":
        await park(outcome.kind);
        break;

      case "unauthorized":
        await settle({});

        return finish("unauthorized", null);

      case "unreachable":
        await settle({});

        return finish("unreachable", null);

      case "ambiguous": {
        const attempts = claimed.attempts + 1;

        if (attempts >= MAX_AMBIGUOUS_ATTEMPTS) {
          await park("retries-exhausted");

          break;
        }

        await settle({ attempts });

        return finish("retry", retryDelayMs(attempts));
      }
    }
  }

  return finish(null, null);
}
