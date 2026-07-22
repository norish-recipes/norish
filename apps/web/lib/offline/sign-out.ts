/**
 * Explicit sign-out and its offline consequences (ADR-0009).
 *
 * Signing out clears the outgoing account's personalized state on this
 * device: the persisted read cache and the runtime image cache always, and —
 * only after the user confirmed the guided dialog — the active Outbox queue.
 * Identity transitions that bypass explicit sign-out never come through
 * here; they retain the outgoing queue dormant under its owner.
 */
import type { OutboxStore } from "@/lib/outbox";
import type { QueryClient } from "@tanstack/react-query";
import { deleteImageCache } from "@/lib/offline/cache-names";
import { discardAllEntries, outboxStore } from "@/lib/outbox";
import { activeCacheOwner, readBootOwner, wipeReadCache } from "@/lib/query-cache";

/** The account whose offline state a sign-out would affect. */
function signOutOwner(): string | null {
  return activeCacheOwner() ?? readBootOwner();
}

/**
 * How many queued changes (any status — parked ones are unsynced work too)
 * an explicit sign-out would discard. Zero means no warning dialog is needed.
 */
export async function countUnsyncedChanges(store: OutboxStore = outboxStore): Promise<number> {
  const owner = signOutOwner();

  return owner ? store.size(owner) : 0;
}

export interface ClearOfflineStateOptions {
  queryClient: QueryClient;
  /** True only when the user confirmed discarding a non-empty queue. */
  discardQueue: boolean;
  store?: OutboxStore;
}

/**
 * Clear the outgoing account's personalized offline state ahead of the actual
 * auth sign-out. The read cache and images always go; the Outbox is discarded
 * only on explicit confirmation (ADR-0009).
 */
export async function clearOfflineStateForSignOut({
  queryClient,
  discardQueue,
  store = outboxStore,
}: ClearOfflineStateOptions): Promise<void> {
  const owner = signOutOwner();

  if (discardQueue && owner) {
    await discardAllEntries(owner, store);
  }

  await wipeReadCache(queryClient, owner ? { ownerId: owner } : {});
  await deleteImageCache();
}
