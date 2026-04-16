import { useSubscription } from "@trpc/tanstack-react-query";

import { createClientLogger } from "@norish/shared/lib/logger";

import type { ArchiveImportCacheHelpers, CreateArchiveHooksOptions } from "./types";

const log = createClientLogger("ArchiveImportSubscription");

export type ArchiveSubscriptionToastAdapter = {
  showCompletionToast: (imported: number, skipped: number, errors: number) => void;
};

type CreateUseArchiveSubscriptionOptions = CreateArchiveHooksOptions & {
  useArchiveImportCacheHelpers: () => ArchiveImportCacheHelpers;
  useToastAdapter: () => ArchiveSubscriptionToastAdapter;
};

export function createUseArchiveSubscription({
  useTRPC,
  useArchiveImportCacheHelpers,
  useToastAdapter,
}: CreateUseArchiveSubscriptionOptions) {
  return function useArchiveImportSubscription(): void {
    const trpc = useTRPC();
    const { setImportState } = useArchiveImportCacheHelpers();
    const toastAdapter = useToastAdapter();

    useSubscription(
      trpc.archive.onArchiveProgress.subscriptionOptions(undefined, {
        onData: ({ payload }: any) => {
          log.debug({ payload }, "Progress event received");
          setImportState((prev) => {
            if (!prev || !prev.isImporting) {
              return {
                current: payload.current,
                total: payload.total,
                imported: payload.imported,
                skipped: payload.current - payload.imported - payload.errors.length,
                skippedItems: [],
                isImporting: true,
                errors: payload.errors,
              };
            }

            const allErrors = [...(prev.errors || []), ...payload.errors];
            const skipped = payload.current - payload.imported - allErrors.length;

            return {
              ...prev,
              current: payload.current,
              imported: payload.imported,
              errors: allErrors,
              skipped: Math.max(0, skipped),
            };
          });
        },
      })
    );

    useSubscription(
      trpc.archive.onArchiveCompleted.subscriptionOptions(undefined, {
        onData: ({ payload }: any) => {
          log.debug({ payload }, "Completion event received");
          setImportState((prev) => {
            const total = prev?.total ?? payload.imported + payload.skipped + payload.errors.length;

            return {
              current: total,
              total: total,
              imported: payload.imported,
              skipped: payload.skipped,
              skippedItems: payload.skippedItems,
              isImporting: false,
              errors: payload.errors,
            };
          });

          toastAdapter.showCompletionToast(
            payload.imported,
            payload.skipped,
            payload.errors.length
          );
        },
      })
    );
  };
}
