import { isQueuedOutboxSignal } from "@norish/shared/lib/trpc-errors";

export function shouldPreserveOptimisticUpdate(error: unknown): boolean {
  // Preserve only on the Queued signal: backend unreachable AND the Outbox
  // write actually persisted (a marked admission failure rolls back, ADR-0009).
  return isQueuedOutboxSignal(error);
}

/**
 * Build an `onError` handler for imperative-optimistic hooks (the ones whose
 * rollback is a refetch): it calls `invalidate` only when the failed mutation
 * was *not* Queued for offline Replay. On the backend-unreachable signal the
 * optimistic update is kept — the mutation is safely in the Outbox, so
 * refetching would just erase the tentatively applied change.
 */
export function invalidateUnlessPreserved(invalidate: () => void): (error: unknown) => void {
  return (error: unknown) => {
    if (!shouldPreserveOptimisticUpdate(error)) {
      invalidate();
    }
  };
}
