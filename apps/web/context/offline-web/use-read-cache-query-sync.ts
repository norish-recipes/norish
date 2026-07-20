import type { WebConnectivityRuntime } from "@/lib/connectivity";
import type { Query, QueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { serializeWebReadCacheQueryKey } from "@/lib/offline-read-cache";

type UseReadCacheQuerySyncOptions = {
  confirmScopeFromHousehold: (query: Query) => Promise<void>;
  connectivityRuntime: WebConnectivityRuntime;
  isRestoringQuery: (identity: string) => boolean;
  recordSuccessfulQuery: (query: Query, manual: boolean) => void;
  queryClient: QueryClient;
  forgetRestoredQueryData: (identity: string) => void;
  removeRestoredQuery: (identity: string) => void;
  restoreQueryFromCache: (query: Query) => void;
};

export function useReadCacheQuerySync({
  confirmScopeFromHousehold,
  connectivityRuntime,
  isRestoringQuery,
  recordSuccessfulQuery,
  queryClient,
  forgetRestoredQueryData,
  removeRestoredQuery,
  restoreQueryFromCache,
}: UseReadCacheQuerySyncOptions) {
  useEffect(() => {
    const scheduledRestores = new Set<ReturnType<typeof setTimeout>>();
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === "removed") {
        forgetRestoredQueryData(serializeWebReadCacheQueryKey(event.query.queryKey));

        return;
      }

      if (event.type === "observerAdded") {
        const timer = setTimeout(() => {
          scheduledRestores.delete(timer);
          if (connectivityRuntime.isDegraded()) restoreQueryFromCache(event.query);
        }, 0);

        scheduledRestores.add(timer);

        return;
      }

      if (event.type !== "updated" || event.action.type !== "success") return;

      const identity = serializeWebReadCacheQueryKey(event.query.queryKey);
      const manual = event.action.manual === true;

      if (manual) {
        if (!isRestoringQuery(identity)) recordSuccessfulQuery(event.query, true);

        return;
      }
      if (connectivityRuntime.isDegraded()) return;

      void confirmScopeFromHousehold(event.query);
      recordSuccessfulQuery(event.query, false);
      removeRestoredQuery(identity);
    });

    return () => {
      unsubscribe();
      for (const timer of scheduledRestores) clearTimeout(timer);
    };
  }, [
    confirmScopeFromHousehold,
    connectivityRuntime,
    forgetRestoredQueryData,
    isRestoringQuery,
    queryClient,
    recordSuccessfulQuery,
    removeRestoredQuery,
    restoreQueryFromCache,
  ]);
}
