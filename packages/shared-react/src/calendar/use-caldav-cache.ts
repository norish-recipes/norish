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

  return {
    // Read when a write runs, so the caller needn't subscribe to the config.
    cachedConfigVersion: () =>
      queryClient.getQueryData<UserCaldavConfigWithoutPasswordDto | null>(configKey)?.version,
    setConfig: (updater) => writeOverRead(queryClient, configKey, updater),
    // The stored password a save or delete replaced; the next read asks the server.
    dropPassword: () => queryClient.removeQueries({ queryKey: trpc.caldav.getPassword.queryKey() }),
    invalidateConfig: () => {
      void queryClient.invalidateQueries({ queryKey: configKey });
    },
    // Every cached page of the sync status list.
    setStatuses: (updater) => {
      for (const [key] of queryClient.getQueriesData({ queryKey: syncStatusPath })) {
        queryClient.setQueryData(key, updater);
      }
    },
    invalidateSyncStatus: () => {
      void queryClient.invalidateQueries({ queryKey: syncStatusPath });
    },
    invalidateSummary: () => {
      void queryClient.invalidateQueries({ queryKey: trpc.caldav.getSummary.queryKey() });
    },
    // Back to pending, so the badge shows the check a changed config needs until it answers.
    resetConnection: () => {
      void queryClient.resetQueries({ queryKey: trpc.caldav.checkConnection.queryKey() });
    },
  };
}
