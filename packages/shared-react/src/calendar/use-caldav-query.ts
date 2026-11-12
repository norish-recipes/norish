import { hashKey, useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  CaldavSyncStatus,
  UserCaldavConfigWithoutPasswordDto,
} from "@norish/shared/contracts";

import type {
  CaldavConfigQueryResult,
  CaldavSummaryQueryResult,
  CaldavSyncStatusQueryResult,
} from "./types";
import { useTRPC } from "../trpc";

type CaldavConfig = UserCaldavConfigWithoutPasswordDto | null;

/** The config, or through `select` a slice of it, so a reader re-renders only when that slice changes. */
export function useCaldavConfigQuery(): CaldavConfigQueryResult;
export function useCaldavConfigQuery<T>(
  select: (config: CaldavConfig) => T
): Omit<CaldavConfigQueryResult, "config"> & { config: T | undefined };
export function useCaldavConfigQuery(
  select?: (config: CaldavConfig) => unknown
): Omit<CaldavConfigQueryResult, "config"> & { config: unknown } {
  const trpc = useTRPC();
  const { data, error, isLoading } = useQuery({
    ...trpc.caldav.getConfig.queryOptions(),
    select: select ?? ((config: CaldavConfig) => config),
  });

  return { config: select ? data : (data ?? null), error, isLoading };
}

/** The stored password, read while the edit form that shows it is mounted and dropped after. */
export function useCaldavPasswordQuery() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const options = trpc.caldav.getPassword.queryOptions(undefined, { staleTime: 0, gcTime: 0 });
  const { data, error, isLoading } = useQuery(options);

  return {
    password: data ?? null,
    /** The cached password until a save marks it stale, else a read's answer; null on a failed read. */
    read: () =>
      queryClient
        .query({ ...options, staleTime: Infinity })
        .then((password) => password ?? null)
        .catch(() => null),
    error,
    isLoading,
  };
}

export function useCaldavSyncStatusQuery(input: {
  page: number;
  pageSize: number;
  statusFilter?: CaldavSyncStatus;
}): CaldavSyncStatusQueryResult {
  const trpc = useTRPC();
  const { data, error, isLoading, isPlaceholderData } = useQuery(
    trpc.caldav.getSyncStatus.queryOptions(input, {
      // The page on screen stays while the next page of its filter loads, never another filter's.
      placeholderData: (previous, previousQuery) =>
        previous &&
        previousQuery?.queryHash ===
          hashKey(trpc.caldav.getSyncStatus.queryKey({ ...input, page: previous.page }))
          ? previous
          : undefined,
    })
  );

  return {
    statuses: data?.statuses ?? [],
    total: data?.total ?? 0,
    page: data?.page ?? input.page,
    pageSize: data?.pageSize ?? input.pageSize,
    error,
    isLoading,
    isPlaceholderData,
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

/**
 * The server's check of the CalDAV connection, only while a config exists:
 * each minute while it holds, each five while not.
 */
export function useCaldavConnectionQuery() {
  const trpc = useTRPC();
  const { config: configured } = useCaldavConfigQuery((config) => config !== null);
  const { data, isPending } = useQuery(
    trpc.caldav.checkConnection.queryOptions(undefined, {
      enabled: configured === true,
      staleTime: 30_000,
      refetchInterval: (query) => (query.state.data?.success ? 60_000 : 300_000),
    })
  );

  return { isChecking: isPending, isConnected: data?.success ?? false };
}
