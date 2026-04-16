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
    const trpc = useTRPC();
    const { config, setConfig, invalidate: invalidateConfig } = useCaldavConfigQuery();
    const { invalidate: invalidateSyncStatus } = useCaldavSyncStatusQuery();
    const { invalidate: invalidateSummary } = useCaldavSummaryQuery();
    const currentConfigVersion = config?.version;

    const saveConfigMutation = useMutation(trpc.caldav.saveConfig.mutationOptions());
    const testConnectionMutation = useMutation(trpc.caldav.testConnection.mutationOptions());
    const fetchCalendarsMutation = useMutation(trpc.caldav.fetchCalendars.mutationOptions());
    const deleteConfigMutation = useMutation(trpc.caldav.deleteConfig.mutationOptions());
    const triggerSyncMutation = useMutation(trpc.caldav.triggerSync.mutationOptions());
    const syncAllMutation = useMutation(trpc.caldav.syncAll.mutationOptions());

    return {
      saveConfig: async (input: SaveCaldavConfigInput) => {
        const result = await saveConfigMutation.mutateAsync({
          ...input,
          version: resolveCaldavConfigVersion(input.version, currentConfigVersion),
        });

        setConfig(() => result);
        invalidateSyncStatus();
        invalidateSummary();

        return result;
      },
      testConnection: async (input: TestConnectionInput) => {
        return testConnectionMutation.mutateAsync(input);
      },
      fetchCalendars: async (input: FetchCalendarsInput) => {
        return fetchCalendarsMutation.mutateAsync(input);
      },
      deleteConfig: async (deleteEvents: boolean = false) => {
        await deleteConfigMutation.mutateAsync({ deleteEvents, version: currentConfigVersion });
        setConfig(() => null);
        invalidateConfig();
        invalidateSyncStatus();
        invalidateSummary();
      },
      triggerSync: async () => {
        await triggerSyncMutation.mutateAsync();
      },
      syncAll: async () => {
        await syncAllMutation.mutateAsync();
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
