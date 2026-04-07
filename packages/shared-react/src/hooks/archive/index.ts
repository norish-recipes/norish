import type { CreateArchiveHooksOptions } from "./types";
import type { ArchiveMutationToastAdapter } from "./use-archive-mutation";
import type { ArchiveSubscriptionToastAdapter } from "./use-archive-subscription";
import { createUseArchiveCache } from "./use-archive-cache";
import { createUseArchiveMutation } from "./use-archive-mutation";
import { createUseArchiveQuery } from "./use-archive-query";
import { createUseArchiveSubscription } from "./use-archive-subscription";

export type {
  CreateArchiveHooksOptions,
  ArchiveImportCacheHelpers,
  ArchiveImportMutationResult,
  ArchiveImportQueryResult,
  ArchiveImportState,
} from "./types";

export { createUseArchiveCache, ARCHIVE_IMPORT_KEY } from "./use-archive-cache";
export { createUseArchiveQuery } from "./use-archive-query";
export { createUseArchiveMutation, type ArchiveMutationToastAdapter } from "./use-archive-mutation";
export {
  createUseArchiveSubscription,
  type ArchiveSubscriptionToastAdapter,
} from "./use-archive-subscription";

type CreateArchiveHooksFullOptions = CreateArchiveHooksOptions & {
  useMutationToastAdapter: () => ArchiveMutationToastAdapter;
  useSubscriptionToastAdapter: () => ArchiveSubscriptionToastAdapter;
};

export function createArchiveHooks({
  useTRPC,
  useMutationToastAdapter,
  useSubscriptionToastAdapter,
}: CreateArchiveHooksFullOptions) {
  const useArchiveImportCacheHelpers = createUseArchiveCache();
  const useArchiveImportQuery = createUseArchiveQuery();
  const useArchiveImportMutation = createUseArchiveMutation({
    useTRPC,
    useArchiveImportQuery,
    useToastAdapter: useMutationToastAdapter,
  });
  const useArchiveImportSubscription = createUseArchiveSubscription({
    useTRPC,
    useArchiveImportCacheHelpers,
    useToastAdapter: useSubscriptionToastAdapter,
  });

  return {
    useArchiveImportQuery,
    useArchiveImportMutation,
    useArchiveImportCacheHelpers,
    useArchiveImportSubscription,
  };
}
