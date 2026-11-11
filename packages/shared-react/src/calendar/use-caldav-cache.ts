import { useQueryClient } from "@tanstack/react-query";

import type { UserCaldavConfigWithoutPasswordDto } from "@norish/shared/contracts";

import type { CaldavCacheHelpers } from "./types";
import { writeOverRead } from "../offline/write-over-read";
import { useTRPC } from "../trpc";

export function useCaldavCacheHelpers(): CaldavCacheHelpers {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const syncStatusPath = trpc.caldav.getSyncStatus.pathKey();
  const configKey = trpc.caldav.getConfig.queryKey();

  const invalidateSyncStatus = () => {
    void queryClient.invalidateQueries({ queryKey: syncStatusPath });
  };
  const invalidateSummary = () => {
    void queryClient.invalidateQueries({ queryKey: trpc.caldav.getSummary.queryKey() });
  };

  return {
    // Read when a write runs, so the caller needn't subscribe to the config.
    cachedConfigVersion: () =>
      queryClient.getQueryData<UserCaldavConfigWithoutPasswordDto | null>(configKey)?.version,
    // Cache writes only, so the configSaved event that also lands here can't emit another.
    applySavedConfig: (config) => {
      writeOverRead(queryClient, configKey, () => config);
      // Stale without a refetch: a mounted form asks for nothing, the next read() asks the server.
      // A read under way is cancelled first, else its pre-save answer lands as fresh.
      const password = { queryKey: trpc.caldav.getPassword.queryKey() };

      void queryClient.cancelQueries(password);
      void queryClient.invalidateQueries({ ...password, refetchType: "none" });
      invalidateSyncStatus();
      invalidateSummary();
      // Back to pending, so the badge shows the check a changed config needs until it answers.
      // Removed with no config: a reset would refetch for an observer not yet disabled.
      const connection = { queryKey: trpc.caldav.checkConnection.queryKey() };

      if (config) void queryClient.resetQueries(connection);
      else queryClient.removeQueries(connection);
    },
    invalidateConfig: () => {
      void queryClient.invalidateQueries({ queryKey: configKey });
    },
    // Every cached page of the sync status list.
    setStatuses: (updater) => {
      for (const [key] of queryClient.getQueriesData({ queryKey: syncStatusPath })) {
        queryClient.setQueryData(key, updater);
      }
    },
    invalidateSyncStatus,
    invalidateSummary,
  };
}
