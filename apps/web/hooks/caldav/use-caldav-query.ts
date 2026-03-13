"use client";

import type { QueryKey } from "@tanstack/react-query";
import type {
  CaldavSyncStatusSummaryDto,
  CaldavSyncStatusViewDto,
  UserCaldavConfigWithoutPasswordDto,
} from "@norish/shared/contracts";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useTRPC } from "@/app/providers/trpc-provider";


export type CaldavConfigQueryResult = {
  config: UserCaldavConfigWithoutPasswordDto | null;
  error: unknown;
  isLoading: boolean;
  queryKey: QueryKey;
  setConfig: (
    updater: (
      prev: UserCaldavConfigWithoutPasswordDto | null | undefined
    ) => UserCaldavConfigWithoutPasswordDto | null | undefined
  ) => void;
  invalidate: () => void;
};

export type CaldavSyncStatusQueryResult = {
  statuses: CaldavSyncStatusViewDto[];
  total: number;
  page: number;
  pageSize: number;
  error: unknown;
  isLoading: boolean;
  queryKey: QueryKey;
  setStatuses: (
    updater: (
      prev:
        | { statuses: CaldavSyncStatusViewDto[]; total: number; page: number; pageSize: number }
        | undefined
    ) =>
      | { statuses: CaldavSyncStatusViewDto[]; total: number; page: number; pageSize: number }
      | undefined
  ) => void;
  invalidate: () => void;
};

export type CaldavSummaryQueryResult = {
  summary: CaldavSyncStatusSummaryDto;
  error: unknown;
  isLoading: boolean;
  queryKey: QueryKey;
  invalidate: () => void;
};

/**
 * Query hook for CalDAV configuration (without password).
 */
export function useCaldavConfigQuery(): CaldavConfigQueryResult {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const queryKey = trpc.caldav.getConfig.queryKey();

  const { data, error, isLoading } = useQuery(trpc.caldav.getConfig.queryOptions());

  const setConfig = (
    updater: (
      prev: UserCaldavConfigWithoutPasswordDto | null | undefined
    ) => UserCaldavConfigWithoutPasswordDto | null | undefined
  ) => {
    queryClient.setQueryData<UserCaldavConfigWithoutPasswordDto | null>(queryKey, updater);
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey });
  };

  return {
    config: data ?? null,
    error,
    isLoading,
    queryKey,
    setConfig,
    invalidate,
  };
}

/**
 * Query hook for CalDAV password (for editing configuration).
 */
export function useCaldavPasswordQuery(): {
  password: string | null;
  error: unknown;
  isLoading: boolean;
} {
  const trpc = useTRPC();

  const { data, error, isLoading } = useQuery(
    trpc.caldav.getPassword.queryOptions(undefined, {
      // Don't cache password for security
      staleTime: 0,
      gcTime: 0,
    })
  );

  return {
    password: data ?? null,
    error,
    isLoading,
  };
}

/**
 * Query hook for CalDAV sync status with pagination.
 */
export function useCaldavSyncStatusQuery(
  page: number = 1,
  pageSize: number = 20,
  statusFilter?: "pending" | "synced" | "failed" | "removed"
): CaldavSyncStatusQueryResult {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const queryKey = trpc.caldav.getSyncStatus.queryKey({
    page,
    pageSize,
    statusFilter,
  });

  const { data, error, isLoading } = useQuery(
    trpc.caldav.getSyncStatus.queryOptions({
      page,
      pageSize,
      statusFilter,
    })
  );

  const setStatuses = (
    updater: (
      prev:
        | { statuses: CaldavSyncStatusViewDto[]; total: number; page: number; pageSize: number }
        | undefined
    ) =>
      | { statuses: CaldavSyncStatusViewDto[]; total: number; page: number; pageSize: number }
      | undefined
  ) => {
    queryClient.setQueryData(queryKey, updater);
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey });
  };

  return {
    statuses: data?.statuses ?? [],
    total: data?.total ?? 0,
    page: data?.page ?? page,
    pageSize: data?.pageSize ?? pageSize,
    error,
    isLoading,
    queryKey,
    setStatuses,
    invalidate,
  };
}

/**
 * Query hook for CalDAV sync summary counts.
 */
export function useCaldavSummaryQuery(): CaldavSummaryQueryResult {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const queryKey = trpc.caldav.getSummary.queryKey();

  const { data, error, isLoading } = useQuery(trpc.caldav.getSummary.queryOptions());

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey });
  };

  return {
    summary: data ?? { pending: 0, synced: 0, failed: 0, removed: 0 },
    error,
    isLoading,
    queryKey,
    invalidate,
  };
}

/**
 * Query hook for CalDAV connection status check.
 */
export function useCaldavConnectionQuery(): {
  isConnected: boolean;
  message: string;
  error: unknown;
  isLoading: boolean;
  invalidate: () => void;
} {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const queryKey = trpc.caldav.checkConnection.queryKey();

  const { data, error, isLoading } = useQuery(
    trpc.caldav.checkConnection.queryOptions(undefined, {
      // Don't cache connection status for long
      staleTime: 30_000, // 30 seconds
    })
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey });
  };

  return {
    isConnected: data?.success ?? false,
    message: data?.message ?? "",
    error,
    isLoading,
    invalidate,
  };
}
