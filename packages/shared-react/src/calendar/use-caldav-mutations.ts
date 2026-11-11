import { useMutation } from "@tanstack/react-query";

import type { CaldavMutationsResult, SaveCaldavConfigInput } from "./types";
import { useTRPC } from "../trpc";
import { useCaldavCacheHelpers } from "./use-caldav-cache";

export function resolveCaldavConfigVersion(
  inputVersion?: number,
  currentVersion?: number
): number | undefined {
  return inputVersion ?? currentVersion;
}

export function useCaldavMutations(): CaldavMutationsResult {
  const trpc = useTRPC();
  const {
    cachedConfigVersion,
    setConfig,
    invalidateConfig,
    invalidateSyncStatus,
    invalidateSummary,
  } = useCaldavCacheHelpers();

  const saveConfigMutation = useMutation(trpc.caldav.saveConfig.mutationOptions());
  const { mutateAsync: mutateSaveConfigAsync } = saveConfigMutation;
  const testConnectionMutation = useMutation(trpc.caldav.testConnection.mutationOptions());
  const fetchCalendarsMutation = useMutation(trpc.caldav.fetchCalendars.mutationOptions());
  const deleteConfigMutation = useMutation(trpc.caldav.deleteConfig.mutationOptions());
  const { mutateAsync: mutateDeleteConfigAsync } = deleteConfigMutation;
  const triggerSyncMutation = useMutation(trpc.caldav.triggerSync.mutationOptions());
  const { mutateAsync: mutateTriggerSyncAsync } = triggerSyncMutation;
  const syncAllMutation = useMutation(trpc.caldav.syncAll.mutationOptions());
  const { mutateAsync: mutateSyncAllAsync } = syncAllMutation;

  return {
    saveConfig: async (input: SaveCaldavConfigInput) => {
      const result = await mutateSaveConfigAsync({
        ...input,
        version: resolveCaldavConfigVersion(input.version, cachedConfigVersion()),
      });

      setConfig(() => result);
      invalidateSyncStatus();
      invalidateSummary();

      return result;
    },
    testConnection: testConnectionMutation.mutateAsync,
    fetchCalendars: fetchCalendarsMutation.mutateAsync,
    deleteConfig: async (deleteEvents: boolean = false) => {
      await mutateDeleteConfigAsync({ deleteEvents, version: cachedConfigVersion() });
      setConfig(() => null);
      invalidateConfig();
      invalidateSyncStatus();
      invalidateSummary();
    },
    // Drop the server's answer: callers only await the sync's start.
    triggerSync: async () => {
      await mutateTriggerSyncAsync();
    },
    syncAll: async () => {
      await mutateSyncAllAsync();
    },
    isSavingConfig: saveConfigMutation.isPending,
    isTestingConnection: testConnectionMutation.isPending,
    isFetchingCalendars: fetchCalendarsMutation.isPending,
    isDeletingConfig: deleteConfigMutation.isPending,
    isTriggeringSync: triggerSyncMutation.isPending,
    isSyncingAll: syncAllMutation.isPending,
  };
}
