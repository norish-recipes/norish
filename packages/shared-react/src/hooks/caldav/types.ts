import type { QueryKey } from "@tanstack/react-query";
import type { createTRPCContext } from "@trpc/tanstack-react-query";

import type {
  CalDavCalendarInfo,
  CaldavSyncStatusSummaryDto,
  CaldavSyncStatusViewDto,
  ConnectionTestResult,
  UserCaldavConfigWithoutPasswordDto,
} from "@norish/shared/contracts";
import type { AppRouter } from "@norish/trpc/client";

type TrpcContext = ReturnType<typeof createTRPCContext<AppRouter>>;
export type TrpcHookBinding = ReturnType<TrpcContext["useTRPC"]>;

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

export type SaveCaldavConfigInput = {
  version?: number;
  serverUrl: string;
  calendarUrl?: string | null;
  username: string;
  password: string;
  enabled: boolean;
  breakfastTime: string;
  lunchTime: string;
  dinnerTime: string;
  snackTime: string;
};

export type TestConnectionInput = {
  serverUrl: string;
  username: string;
  password: string;
};

export type FetchCalendarsInput = {
  serverUrl: string;
  username: string;
  password: string;
};

export type CaldavMutationsResult = {
  saveConfig: (input: SaveCaldavConfigInput) => Promise<UserCaldavConfigWithoutPasswordDto>;
  testConnection: (input: TestConnectionInput) => Promise<ConnectionTestResult>;
  fetchCalendars: (input: FetchCalendarsInput) => Promise<CalDavCalendarInfo[]>;
  deleteConfig: (deleteEvents?: boolean) => Promise<void>;
  triggerSync: () => Promise<void>;
  syncAll: () => Promise<void>;
  isSavingConfig: boolean;
  isTestingConnection: boolean;
  isFetchingCalendars: boolean;
  isDeletingConfig: boolean;
  isTriggeringSync: boolean;
  isSyncingAll: boolean;
};

export interface CreateCaldavHooksOptions {
  useTRPC: () => TrpcHookBinding;
}
