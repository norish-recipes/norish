import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type {
  CaldavSyncStatusViewDto,
  UserCaldavConfigWithoutPasswordDto,
} from "@norish/shared/contracts";

import type { CaldavCacheHelpers, CreateCaldavHooksOptions } from "./types";

export function createUseCaldavCache({ useTRPC }: CreateCaldavHooksOptions) {
  return function useCaldavCacheHelpers(): CaldavCacheHelpers {
    "use memo";

    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const configQueryKey = trpc.caldav.getConfig.queryKey();
    const syncStatusPath = trpc.caldav.getSyncStatus.pathKey();
    const summaryQueryKey = trpc.caldav.getSummary.queryKey();

    const setConfig = useCallback(
      (
        updater: (
          prev: UserCaldavConfigWithoutPasswordDto | null | undefined
        ) => UserCaldavConfigWithoutPasswordDto | null | undefined
      ) => {
        queryClient.setQueryData<UserCaldavConfigWithoutPasswordDto | null>(
          configQueryKey,
          updater
        );
      },
      [queryClient, configQueryKey]
    );

    const setStatuses = useCallback(
      (
        updater: (
          prev:
            | { statuses: CaldavSyncStatusViewDto[]; total: number; page: number; pageSize: number }
            | undefined
        ) =>
          | { statuses: CaldavSyncStatusViewDto[]; total: number; page: number; pageSize: number }
          | undefined
      ) => {
        const queries = queryClient.getQueriesData<{
          statuses: CaldavSyncStatusViewDto[];
          total: number;
          page: number;
          pageSize: number;
        }>({
          queryKey: syncStatusPath,
        });

        for (const [key] of queries) {
          queryClient.setQueryData(key, updater);
        }
      },
      [queryClient, syncStatusPath]
    );

    const invalidateSyncStatus = useCallback(() => {
      queryClient.invalidateQueries({ queryKey: syncStatusPath });
    }, [queryClient, syncStatusPath]);

    const invalidateSummary = useCallback(() => {
      queryClient.invalidateQueries({ queryKey: summaryQueryKey });
    }, [queryClient, summaryQueryKey]);

    return { setConfig, setStatuses, invalidateSyncStatus, invalidateSummary };
  };
}
