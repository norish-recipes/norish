import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";

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

export function useCaldavConfigQuery(): CaldavConfigQueryResult {
  const trpc = useTRPC();
  const { data, error, isLoading } = useQuery(trpc.caldav.getConfig.queryOptions());

  return { config: data ?? null, error, isLoading };
}

/** A slice of the config, so a reader re-renders only when that slice changes. */
export function useCaldavConfigSlice<T>(
  select: (config: UserCaldavConfigWithoutPasswordDto | null) => T
) {
  const trpc = useTRPC();
  const { data, isLoading } = useQuery({ ...trpc.caldav.getConfig.queryOptions(), select });

  return { slice: data, isLoading };
}

/** The stored password, read while the edit form that shows it is mounted and dropped after. */
export function useCaldavPasswordQuery() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const options = trpc.caldav.getPassword.queryOptions(undefined, { staleTime: 0, gcTime: 0 });
  const { data, error, isLoading } = useQuery(options);

  return {
    password: data ?? null,
    /** The cached password, which a save drops, else the answer of a read. */
    read: async () => (await queryClient.query({ ...options, staleTime: "static" })) ?? null,
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
  const { data, error, isLoading } = useQuery(
    // The page on screen stays while the next page or filter loads.
    trpc.caldav.getSyncStatus.queryOptions(input, { placeholderData: keepPreviousData })
  );

  return {
    statuses: data?.statuses ?? [],
    total: data?.total ?? 0,
    page: data?.page ?? input.page,
    pageSize: data?.pageSize ?? input.pageSize,
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

/** The server's check of the CalDAV connection: each minute while it holds, each five while not. */
export function useCaldavConnectionQuery() {
  const trpc = useTRPC();
  const { data, isPending } = useQuery(
    trpc.caldav.checkConnection.queryOptions(undefined, {
      staleTime: 30_000,
      refetchInterval: (query) => (query.state.data?.success ? 60_000 : 300_000),
    })
  );

  return { isChecking: isPending, isConnected: data?.success ?? false };
}
