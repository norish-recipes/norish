import { useMutation } from "@tanstack/react-query";

import type {
  CaldavConfigQueryResult,
  CaldavMutationsResult,
  CaldavSummaryQueryResult,
  CaldavSyncStatusQueryResult,
  CreateCaldavHooksOptions,
  FetchCalendarsInput,
  SaveCaldavConfigInput,
  TestConnectionInput,
} from "./types";

export function resolveCaldavConfigVersion(
  inputVersion?: number,
  currentVersion?: number
): number | undefined {
  return inputVersion ?? currentVersion;
}

type CreateUseCaldavMutationsOptions = CreateCaldavHooksOptions & {
  useCaldavConfigQuery: () => CaldavConfigQueryResult;
  useCaldavSyncStatusQuery: () => Pick<CaldavSyncStatusQueryResult, "invalidate">;
  useCaldavSummaryQuery: () => Pick<CaldavSummaryQueryResult, "invalidate">;
};

export function createUseCaldavMutations({
  useTRPC,
  useCaldavConfigQuery,
  useCaldavSyncStatusQuery,
  useCaldavSummaryQuery,
}: CreateUseCaldavMutationsOptions) {
  return function useCaldavMutations(): CaldavMutationsResult {
    "use memo";

    const trpc = useTRPC();
    const { config, setConfig, invalidate: invalidateConfig } = useCaldavConfigQuery();
    const { invalidate: invalidateSyncStatus } = useCaldavSyncStatusQuery();
    const { invalidate: invalidateSummary } = useCaldavSummaryQuery();
    const currentConfigVersion = config?.version;

    const saveConfigMutation = useMutation(trpc.caldav.saveConfig.mutationOptions());
    const { mutateAsync: mutateSaveConfigAsync } = saveConfigMutation;
    const testConnectionMutation = useMutation(trpc.caldav.testConnection.mutationOptions());
    const { mutateAsync: mutateTestConnectionAsync } = testConnectionMutation;
    const fetchCalendarsMutation = useMutation(trpc.caldav.fetchCalendars.mutationOptions());
    const { mutateAsync: mutateFetchCalendarsAsync } = fetchCalendarsMutation;
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
          version: resolveCaldavConfigVersion(input.version, currentConfigVersion),
        });

        setConfig(() => result);
        invalidateSyncStatus();
        invalidateSummary();

        return result;
      },
      testConnection: async (input: TestConnectionInput) => {
        return mutateTestConnectionAsync(input);
      },
      fetchCalendars: async (input: FetchCalendarsInput) => {
        return mutateFetchCalendarsAsync(input);
      },
      deleteConfig: async (deleteEvents: boolean = false) => {
        await mutateDeleteConfigAsync({ deleteEvents, version: currentConfigVersion });
        setConfig(() => null);
        invalidateConfig();
        invalidateSyncStatus();
        invalidateSummary();
      },
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
  };
}
