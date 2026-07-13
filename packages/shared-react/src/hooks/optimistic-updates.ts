import { isQueuedDeliveryError } from "@norish/shared/lib/queued-delivery";
import { isBackendUnreachableError } from "@norish/shared/lib/trpc-errors";

export type OptimisticUpdatePreserver = (error: unknown) => boolean;

export function shouldPreserveOptimisticUpdate(
  error: unknown,
  preserve?: OptimisticUpdatePreserver
): boolean {
  if (preserve) {
    return preserve(error);
  }

  return isBackendUnreachableError(error) || isQueuedDeliveryError(error);
}
