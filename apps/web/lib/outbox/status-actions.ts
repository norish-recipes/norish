import type { OutboxStore } from "./outbox-store";
import type { ReplayPassResult } from "./replay";
import { outboxStore } from "./outbox-store";
import { processQueue } from "./replay";

/**
 * Bulk Outbox actions for the status modal (commit 9).
 *
 * The modal exposes a generic Outbox list with two bulk controls; these compose
 * them from the primitive store + Replay operations.
 */

/**
 * Un-park every Parked/Conflicted entry for an owner, then drain — the modal's
 * bulk "Retry all". Parking is never permanent: a manual retry resets the entry
 * to pending and lets Replay attempt it again.
 */
export async function retryParkedEntries(
  ownerId: string,
  store: OutboxStore = outboxStore
): Promise<ReplayPassResult> {
  const parked = (await store.forOwner(ownerId)).filter(
    (entry) => entry.status === "parked" || entry.status === "conflicted"
  );

  await Promise.all(
    parked.map((entry) => store.update(entry.seq, { status: "pending", parkedReason: undefined }))
  );

  return processQueue(store);
}

/**
 * Remove every queued mutation for an owner — the modal's bulk "Discard all".
 * Discarding the whole queue takes dependent edits with their create, so no
 * silent phantom is ever left pointing at a discarded entity. Callers invalidate
 * queries afterwards so the optimistically-applied changes reconcile against
 * server truth; the persisted read cache is untouched. Returns the count removed.
 */
export async function discardAllEntries(
  ownerId: string,
  store: OutboxStore = outboxStore
): Promise<number> {
  const entries = await store.forOwner(ownerId);

  await Promise.all(entries.map((entry) => store.remove(entry.seq)));

  return entries.length;
}
