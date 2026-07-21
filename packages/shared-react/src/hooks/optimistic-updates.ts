import { isBackendUnreachableError } from "@norish/shared/lib/trpc-errors";

export type OptimisticUpdatePreserver = (error: unknown) => boolean;

export function shouldPreserveOptimisticUpdate(
  error: unknown,
  preserve?: OptimisticUpdatePreserver
): boolean {
  return preserve?.(error) ?? isBackendUnreachableError(error);
}

/**
 * Build an `onError` handler for imperative-optimistic hooks (the ones whose
 * rollback is a refetch): it calls `invalidate` only when the failed mutation
 * was *not* Queued for offline Replay. On the backend-unreachable signal the
 * optimistic update is kept — the mutation is safely in the Outbox, so
 * refetching would just erase the tentatively applied change.
 */
export function invalidateUnlessPreserved(
  invalidate: () => void,
  preserve?: OptimisticUpdatePreserver
): (error: unknown) => void {
  return (error: unknown) => {
    if (!shouldPreserveOptimisticUpdate(error, preserve)) {
      invalidate();
    }
  };
}
