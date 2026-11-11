import { useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  CaldavConfigQueryResult,
  CaldavSummaryQueryResult,
  CaldavSyncStatusQueryResult,
} from "./types";
import { useTRPC } from "../trpc";

export function useCaldavConfigQuery(): CaldavConfigQueryResult {
  const trpc = useTRPC();
  const { data, error, isLoading } = useQuery(trpc.caldav.getConfig.queryOptions());

  return { config: data ?? null, error, isLoading };
}

export function useCaldavPasswordQuery() {
  const trpc = useTRPC();
  const { data, error, isLoading } = useQuery(
    trpc.caldav.getPassword.queryOptions(undefined, {
      staleTime: 0,
      gcTime: 0,
    })
  );

  return { password: data ?? null, error, isLoading };
}

export function useCaldavSyncStatusQuery(
  page: number = 1,
  pageSize: number = 20,
  statusFilter?: "pending" | "synced" | "failed" | "removed"
): CaldavSyncStatusQueryResult {
  const trpc = useTRPC();
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
  };
}

export function useCaldavSummaryQuery(): CaldavSummaryQueryResult {
  const trpc = useTRPC();
  const { data, error, isLoading } = useQuery(trpc.caldav.getSummary.queryOptions());

  return {
    summary: data ?? { pending: 0, synced: 0, failed: 0, removed: 0 },
    error,
    isLoading,
  };
}

export function useCaldavConnectionQuery() {
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
