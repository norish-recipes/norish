import { useMutation } from "@tanstack/react-query";

import type { CaldavMutationsResult, SaveCaldavConfigInput } from "./types";
import { wentThrough } from "../offline/settled";
import { usePlatform } from "../platform/platform";
import { useTRPC } from "../trpc";
import { useCaldavCacheHelpers } from "./use-caldav-cache";

export function useCaldavMutations(): CaldavMutationsResult {
  const trpc = useTRPC();
  const { toast, showError } = usePlatform();
  const { cachedConfigVersion, applySavedConfig, invalidateConfig } = useCaldavCacheHelpers();

  const saveConfigMutation = useMutation(
    trpc.caldav.saveConfig.mutationOptions({
      onSuccess: (result) => {
        applySavedConfig(result);
        toast.show({
          severity: "success",
          title: toast.translate("calendar.caldav.configSaved"),
          description: toast.translate("calendar.caldav.configSavedDescription"),
        });
      },
      onError: (error) => showError(error, "caldav:save-config"),
    })
  );
  const { mutateAsync: mutateSaveConfigAsync } = saveConfigMutation;
  const testConnectionMutation = useMutation(trpc.caldav.testConnection.mutationOptions());
  const { mutateAsync: mutateTestConnectionAsync } = testConnectionMutation;
  const { mutateAsync: mutateDeleteConfigAsync } = useMutation(
    trpc.caldav.deleteConfig.mutationOptions({
      onSuccess: () => {
        applySavedConfig(null);
        // A stale delete removes nothing, so the config is read back.
        invalidateConfig();
        toast.show({
          severity: "success",
          title: toast.translate("calendar.caldav.configDeleted"),
          description: toast.translate("calendar.caldav.configDeletedDescription"),
        });
      },
      onError: (error) => showError(error, "caldav:delete-config"),
    })
  );
  const triggerSyncMutation = useMutation(
    trpc.caldav.triggerSync.mutationOptions({
      onSuccess: () => {
        toast.show({
          severity: "default",
          title: toast.translate("calendar.caldav.retryStarted"),
          description: toast.translate("calendar.caldav.retryStartedDescription"),
        });
      },
      onError: (error) => showError(error, "caldav:trigger-sync"),
    })
  );
  const { mutate: mutateTriggerSync } = triggerSyncMutation;

  return {
    saveConfig: (input: SaveCaldavConfigInput) =>
      wentThrough(
        mutateSaveConfigAsync({ ...input, version: input.version ?? cachedConfigVersion() })
      ),
    testConnection: (input) =>
      mutateTestConnectionAsync(input).catch((error: unknown) => ({
        success: false,
        message: error instanceof Error ? error.message : String(error),
      })),
    deleteConfig: (deleteEvents = false) =>
      wentThrough(mutateDeleteConfigAsync({ deleteEvents, version: cachedConfigVersion() })),
    triggerSync: () => mutateTriggerSync(),
    isSavingConfig: saveConfigMutation.isPending,
    isTestingConnection: testConnectionMutation.isPending,
    isTriggeringSync: triggerSyncMutation.isPending,
  };
}
