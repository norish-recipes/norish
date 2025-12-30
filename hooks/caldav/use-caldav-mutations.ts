"use client";

import type {
  UserCaldavConfigWithoutPasswordDto,
  ConnectionTestResult,
  CalDavCalendarInfo,
} from "@/types";

import { useMutation } from "@tanstack/react-query";

import {
  useCaldavConfigQuery,
  useCaldavSyncStatusQuery,
  useCaldavSummaryQuery,
} from "./use-caldav-query";

import { useTRPC } from "@/app/providers/trpc-provider";

export type SaveCaldavConfigInput = {
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

/**
 * Mutations hook for CalDAV operations.
 */
export function useCaldavMutations(): CaldavMutationsResult {
  const trpc = useTRPC();
  const { setConfig, invalidate: invalidateConfig } = useCaldavConfigQuery();
  const { invalidate: invalidateSyncStatus } = useCaldavSyncStatusQuery();
  const { invalidate: invalidateSummary } = useCaldavSummaryQuery();

  const saveConfigMutation = useMutation(trpc.caldav.saveConfig.mutationOptions());
  const testConnectionMutation = useMutation(trpc.caldav.testConnection.mutationOptions());
  const fetchCalendarsMutation = useMutation(trpc.caldav.fetchCalendars.mutationOptions());
  const deleteConfigMutation = useMutation(trpc.caldav.deleteConfig.mutationOptions());
  const triggerSyncMutation = useMutation(trpc.caldav.triggerSync.mutationOptions());
  const syncAllMutation = useMutation(trpc.caldav.syncAll.mutationOptions());

  const saveConfig = async (
    input: SaveCaldavConfigInput
  ): Promise<UserCaldavConfigWithoutPasswordDto> => {
    const result = await saveConfigMutation.mutateAsync(input);

    // Update cache optimistically
    setConfig(() => result);

    // Invalidate related queries
    invalidateSyncStatus();
    invalidateSummary();

    return result;
  };

  const testConnection = async (input: TestConnectionInput): Promise<ConnectionTestResult> => {
    return testConnectionMutation.mutateAsync(input);
  };

  const fetchCalendars = async (input: FetchCalendarsInput): Promise<CalDavCalendarInfo[]> => {
    return fetchCalendarsMutation.mutateAsync(input);
  };

  const deleteConfig = async (deleteEvents: boolean = false): Promise<void> => {
    await deleteConfigMutation.mutateAsync({ deleteEvents });

    // Update cache
    setConfig(() => null);

    // Invalidate related queries
    invalidateConfig();
    invalidateSyncStatus();
    invalidateSummary();
  };

  const triggerSync = async (): Promise<void> => {
    await triggerSyncMutation.mutateAsync();
    // Sync runs in background, invalidation will happen via subscription
  };

  const syncAll = async (): Promise<void> => {
    await syncAllMutation.mutateAsync();
    // Sync runs in background, invalidation will happen via subscription
  };

  return {
    saveConfig,
    testConnection,
    fetchCalendars,
    deleteConfig,
    triggerSync,
    syncAll,
    isSavingConfig: saveConfigMutation.isPending,
    isTestingConnection: testConnectionMutation.isPending,
    isFetchingCalendars: fetchCalendarsMutation.isPending,
    isDeletingConfig: deleteConfigMutation.isPending,
    isTriggeringSync: triggerSyncMutation.isPending,
    isSyncingAll: syncAllMutation.isPending,
  };
}
