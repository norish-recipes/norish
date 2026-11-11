import { useMutation } from "@tanstack/react-query";

import type { CaldavMutationsResult, SaveCaldavConfigInput } from "./types";
import { usePlatform } from "../platform/platform";
import { useTRPC } from "../trpc";
import { useCaldavCacheHelpers } from "./use-caldav-cache";

export function useCaldavMutations(): CaldavMutationsResult {
  const trpc = useTRPC();
  const { toast } = usePlatform();
  const {
    cachedConfigVersion,
    setConfig,
    invalidateConfig,
    invalidateSyncStatus,
    invalidateSummary,
  } = useCaldavCacheHelpers();

  const saveConfigMutation = useMutation(
    trpc.caldav.saveConfig.mutationOptions({
      onSuccess: (result) => {
        setConfig(() => result);
        invalidateSyncStatus();
        invalidateSummary();
        toast.show({
          severity: "success",
          title: toast.translate("calendar.caldav.configSaved"),
          description: toast.translate("calendar.caldav.configSavedDescription"),
        });
      },
    })
  );
  const { mutateAsync: mutateSaveConfigAsync } = saveConfigMutation;
  const testConnectionMutation = useMutation(trpc.caldav.testConnection.mutationOptions());
  const fetchCalendarsMutation = useMutation(trpc.caldav.fetchCalendars.mutationOptions());
  const deleteConfigMutation = useMutation(
    trpc.caldav.deleteConfig.mutationOptions({
      onSuccess: () => {
        setConfig(() => null);
        invalidateConfig();
        invalidateSyncStatus();
        invalidateSummary();
        toast.show({
          severity: "success",
          title: toast.translate("calendar.caldav.configDeleted"),
          description: toast.translate("calendar.caldav.configDeletedDescription"),
        });
      },
    })
  );
  const { mutateAsync: mutateDeleteConfigAsync } = deleteConfigMutation;
  const triggerSyncMutation = useMutation(
    trpc.caldav.triggerSync.mutationOptions({
      onSuccess: () => {
        toast.show({
          severity: "default",
          title: toast.translate("calendar.caldav.retryStarted"),
          description: toast.translate("calendar.caldav.retryStartedDescription"),
        });
      },
    })
  );
  const { mutateAsync: mutateTriggerSyncAsync } = triggerSyncMutation;
  const syncAllMutation = useMutation(trpc.caldav.syncAll.mutationOptions());
  const { mutateAsync: mutateSyncAllAsync } = syncAllMutation;

  return {
    saveConfig: (input: SaveCaldavConfigInput) =>
      mutateSaveConfigAsync({ ...input, version: input.version ?? cachedConfigVersion() }),
    testConnection: testConnectionMutation.mutateAsync,
    fetchCalendars: fetchCalendarsMutation.mutateAsync,
    deleteConfig: async (deleteEvents: boolean = false) => {
      await mutateDeleteConfigAsync({ deleteEvents, version: cachedConfigVersion() });
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
