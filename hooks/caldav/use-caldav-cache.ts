"use client";

/**
 * Lightweight cache manipulation helpers for CalDAV.
 *
 * This hook provides functions to update the React Query cache WITHOUT
 * creating query observers. Use this in subscription hooks to avoid
 * duplicate hook trees that cause recursion issues.
 *
 * For reading data + cache manipulation, use the caldav query hooks instead.
 */

import type { CaldavSyncStatusViewDto } from "@/types";
import type { UserCaldavConfigWithoutPasswordDto } from "@/types";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { useTRPC } from "@/app/providers/trpc-provider";

export type CaldavCacheHelpers = {
  setConfig: (
    updater: (
      prev: UserCaldavConfigWithoutPasswordDto | null | undefined
    ) => UserCaldavConfigWithoutPasswordDto | null | undefined
  ) => void;
  setStatuses: (
    updater: (
      prev:
        | { statuses: CaldavSyncStatusViewDto[]; total: number; page: number; pageSize: number }
        | undefined
    ) =>
      | { statuses: CaldavSyncStatusViewDto[]; total: number; page: number; pageSize: number }
      | undefined
  ) => void;
  invalidateSyncStatus: () => void;
  invalidateSummary: () => void;
};

/**
 * Returns cache manipulation helpers without creating query observers.
 * Safe to call from subscription hooks - won't cause recursion.
 */
export function useCaldavCacheHelpers(): CaldavCacheHelpers {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const configQueryKey = trpc.caldav.getConfig.queryKey();
  // Get base keys for partial matching (without params)
  const syncStatusBaseKey = trpc.caldav.getSyncStatus.queryKey({
    page: 1,
    pageSize: 20,
  });
  const summaryQueryKey = trpc.caldav.getSummary.queryKey();

  const setConfig = useCallback(
    (
      updater: (
        prev: UserCaldavConfigWithoutPasswordDto | null | undefined
      ) => UserCaldavConfigWithoutPasswordDto | null | undefined
    ) => {
      queryClient.setQueryData<UserCaldavConfigWithoutPasswordDto | null>(configQueryKey, updater);
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
      // Update ALL sync status queries (regardless of pagination/filter params)
      // Use the procedure path for partial matching
      const queries = queryClient.getQueriesData<{
        statuses: CaldavSyncStatusViewDto[];
        total: number;
        page: number;
        pageSize: number;
      }>({
        queryKey: [syncStatusBaseKey[0]],
      });

      for (const [key] of queries) {
        queryClient.setQueryData(key, updater);
      }
    },
    [queryClient, syncStatusBaseKey]
  );

  const invalidateSyncStatus = useCallback(() => {
    // Use the procedure path for partial matching
    queryClient.invalidateQueries({ queryKey: [syncStatusBaseKey[0]] });
  }, [queryClient, syncStatusBaseKey]);

  const invalidateSummary = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: summaryQueryKey });
  }, [queryClient, summaryQueryKey]);

  return {
    setConfig,
    setStatuses,
    invalidateSyncStatus,
    invalidateSummary,
  };
}
