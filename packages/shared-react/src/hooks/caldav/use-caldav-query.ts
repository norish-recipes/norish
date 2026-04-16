import { useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  CaldavConfigQueryResult,
  CaldavSummaryQueryResult,
  CaldavSyncStatusQueryResult,
  CreateCaldavHooksOptions,
} from "./types";

export function createUseCaldavQuery({ useTRPC }: CreateCaldavHooksOptions) {
  function useCaldavConfigQuery(): CaldavConfigQueryResult {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const queryKey = trpc.caldav.getConfig.queryKey();
    const { data, error, isLoading } = useQuery(trpc.caldav.getConfig.queryOptions());

    return {
      config: data ?? null,
      error,
      isLoading,
      queryKey,
      setConfig: (updater) => queryClient.setQueryData(queryKey, updater),
      invalidate: () => queryClient.invalidateQueries({ queryKey }),
    };
  }

  function useCaldavPasswordQuery() {
    const trpc = useTRPC();
    const { data, error, isLoading } = useQuery(
      trpc.caldav.getPassword.queryOptions(undefined, {
        staleTime: 0,
        gcTime: 0,
      })
    );

    return { password: data ?? null, error, isLoading };
  }

  function useCaldavSyncStatusQuery(
    page: number = 1,
    pageSize: number = 20,
    statusFilter?: "pending" | "synced" | "failed" | "removed"
  ): CaldavSyncStatusQueryResult {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const queryKey = trpc.caldav.getSyncStatus.queryKey({ page, pageSize, statusFilter });
    const { data, error, isLoading } = useQuery(
      trpc.caldav.getSyncStatus.queryOptions({ page, pageSize, statusFilter })
    );

    return {
      statuses: data?.statuses ?? [],
      total: data?.total ?? 0,
      page: data?.page ?? page,
      pageSize: data?.pageSize ?? pageSize,
      error,
      isLoading,
      queryKey,
      setStatuses: (updater) => queryClient.setQueryData(queryKey, updater),
      invalidate: () => queryClient.invalidateQueries({ queryKey }),
    };
  }

  function useCaldavSummaryQuery(): CaldavSummaryQueryResult {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const queryKey = trpc.caldav.getSummary.queryKey();
    const { data, error, isLoading } = useQuery(trpc.caldav.getSummary.queryOptions());

    return {
      summary: data ?? { pending: 0, synced: 0, failed: 0, removed: 0 },
      error,
      isLoading,
      queryKey,
      invalidate: () => queryClient.invalidateQueries({ queryKey }),
    };
  }

  function useCaldavConnectionQuery() {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const queryKey = trpc.caldav.checkConnection.queryKey();
    const { data, error, isLoading } = useQuery(
      trpc.caldav.checkConnection.queryOptions(undefined, { staleTime: 30_000 })
    );

    return {
      isConnected: data?.success ?? false,
      message: data?.message ?? "",
      error,
      isLoading,
      invalidate: () => queryClient.invalidateQueries({ queryKey }),
    };
  }

  return {
    useCaldavConfigQuery,
    useCaldavPasswordQuery,
    useCaldavSyncStatusQuery,
    useCaldavSummaryQuery,
    useCaldavConnectionQuery,
  };
}
