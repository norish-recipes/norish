import { isBackendUnreachableError } from "@norish/shared/lib/trpc-errors";

export type OptimisticUpdatePreserver = (error: unknown) => boolean;

export function shouldPreserveOptimisticUpdate(
  error: unknown,
  preserve?: OptimisticUpdatePreserver
): boolean {
  return preserve?.(error) ?? isBackendUnreachableError(error);
}
