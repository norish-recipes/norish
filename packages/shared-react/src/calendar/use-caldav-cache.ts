import { useQueryClient } from "@tanstack/react-query";

import type { CaldavCacheHelpers } from "./types";
import { useTRPC } from "../trpc";

export function useCaldavCacheHelpers(): CaldavCacheHelpers {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const syncStatusPath = trpc.caldav.getSyncStatus.pathKey();

  return {
    setConfig: (updater) => {
      queryClient.setQueryData(trpc.caldav.getConfig.queryKey(), updater);
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
