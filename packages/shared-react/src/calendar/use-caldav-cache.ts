import { useQueryClient } from "@tanstack/react-query";

import type { UserCaldavConfigWithoutPasswordDto } from "@norish/shared/contracts";

import type { CaldavCacheHelpers } from "./types";
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
    setConfig: (updater) => {
      queryClient.setQueryData(configKey, updater);
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
    invalidateSyncStatus: () => {
      void queryClient.invalidateQueries({ queryKey: syncStatusPath });
    },
    invalidateSummary: () => {
      void queryClient.invalidateQueries({ queryKey: trpc.caldav.getSummary.queryKey() });
    },
  };
}
