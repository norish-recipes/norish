import type {
  LiveSessionUser,
  OfflineReadCacheRegistry,
  OfflineWebContextValue,
  OfflineWebPhase,
} from "@/context/offline-web/shared";
import type { WebConnectivityRuntime } from "@/lib/connectivity";
import type { WebReadCacheRepository } from "@/lib/offline-read-cache";
import type { Query, QueryClient, QueryKey } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  useOfflineRecoveryLifecycle,
  useOfflineStartupLifecycle,
} from "@/context/offline-web/use-offline-lifecycle";
import { useOfflineScopeSync } from "@/context/offline-web/use-offline-scope-sync";
import { useReadCachePersistence } from "@/context/offline-web/use-read-cache-persistence";
import { useReadCacheQuerySync } from "@/context/offline-web/use-read-cache-query-sync";
import { useReadCacheState } from "@/context/offline-web/use-read-cache-state";
import { useWebConnectivityRuntime } from "@/lib/connectivity";
import { serializeWebReadCacheQueryKey } from "@/lib/offline-read-cache";

type OfflineWebSession = {
  data?: { user: LiveSessionUser } | null;
  error: unknown;
  isPending: boolean;
};

type UseOfflineWebControllerOptions = {
  cacheRepository: WebReadCacheRepository;
  connectivityRuntime: WebConnectivityRuntime;
  fallbackDeadlineMs: number;
  queryClient: QueryClient;
  registry: OfflineReadCacheRegistry;
  session: OfflineWebSession;
};

export function useOfflineWebController({
  cacheRepository,
  connectivityRuntime,
  fallbackDeadlineMs,
  queryClient,
  registry,
  session,
}: UseOfflineWebControllerOptions): OfflineWebContextValue {
  const sessionUser = session.data?.user;
  const connectivity = useWebConnectivityRuntime(connectivityRuntime);
  const [phase, setPhase] = useState<OfflineWebPhase>("probing-live");
  const phaseRef = useRef<OfflineWebPhase>("probing-live");
  const commitPhase = useCallback((next: OfflineWebPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);
  const readCache = useReadCacheState({
    cacheRepository,
    commitPhase,
    liveUserId: session.error ? null : (sessionUser?.id ?? null),
    queryClient,
  });

  useOfflineStartupLifecycle({
    commitPhase,
    connectivityRuntime,
    connectivityState: connectivity.state,
    connectivityTransportFailureConfirmed: connectivity.transportFailureConfirmed,
    fallbackDeadlineMs,
    phase,
    phaseRef,
    prepareScope: readCache.prepareScope,
    restoredQueryCount: readCache.restoredQueryCount,
    restoreFallback: readCache.restoreFallback,
  });

  const persistence = useReadCachePersistence({
    activeScopeRef: readCache.activeScopeRef,
    cacheRepository,
    connectivityRuntime,
    queryClient,
    refreshInventory: readCache.refreshInventory,
    registry,
    restoredQueryIdentitiesRef: readCache.restoredQueryIdentitiesRef,
    setPersistenceWarning: readCache.setPersistenceWarning,
  });
  const scope = useOfflineScopeSync({
    cacheRepository,
    connectivityLastSuccessAt: connectivity.lastSuccessAt,
    connectivityRuntime,
    persistExistingQueries: persistence.persistExistingQueries,
    preparedScopeRef: readCache.preparedScopeRef,
    queryClient,
    refreshInventory: readCache.refreshInventory,
    registry,
    sessionError: session.error,
    sessionPending: session.isPending,
    sessionUser,
    activeScopeRef: readCache.activeScopeRef,
    discardRestoredScope: readCache.discardRestoredScope,
    setActiveScope: readCache.setActiveScope,
    setPersistenceWarning: readCache.setPersistenceWarning,
  });

  useReadCacheQuerySync({
    confirmScopeFromHousehold: scope.confirmScopeFromHousehold,
    connectivityRuntime,
    isRestoringQuery: readCache.isRestoringQuery,
    recordSuccessfulQuery: persistence.recordSuccessfulQuery,
    queryClient,
    forgetRestoredQueryData: readCache.forgetRestoredQueryData,
    removeRestoredQuery: readCache.removeRestoredQuery,
    restoreQueryFromCache: readCache.restoreQueryFromCache,
  });
  useOfflineRecoveryLifecycle({
    commitPhase,
    connectivityRuntime,
    pruneInactiveRestoredQueries: readCache.pruneInactiveRestoredQueries,
    refreshInventory: readCache.refreshInventory,
    restoredQueryIdentitiesRef: readCache.restoredQueryIdentitiesRef,
    restoreFallback: readCache.restoreFallback,
  });

  const [unavailableViewCount, setUnavailableViewCount] = useState(0);
  const registerVisibleDataUnavailable = useCallback(() => {
    let registered = true;

    setUnavailableViewCount((current) => current + 1);

    return () => {
      if (!registered) return;

      registered = false;
      setUnavailableViewCount((current) => Math.max(0, current - 1));
    };
  }, []);
  const visibleDataUnavailable = unavailableViewCount > 0;
  const checkQueryUnavailable = readCache.isQueryUnavailable;
  const queryHasRestoredActiveData = useCallback(
    (query: Query) =>
      query.isActive() &&
      query.state.data !== undefined &&
      readCache.restoredQueryIdentitiesRef.current.has(
        serializeWebReadCacheQueryKey(query.queryKey)
      ),
    [readCache.restoredQueryIdentitiesRef]
  );
  const subscribeToQueryCache = useCallback(
    (listener: () => void) => {
      let scheduledNotification: ReturnType<typeof setTimeout> | null = null;
      const unsubscribe = queryClient.getQueryCache().subscribe(() => {
        if (scheduledNotification) return;

        scheduledNotification = setTimeout(() => {
          scheduledNotification = null;
          listener();
        }, 0);
      });

      return () => {
        unsubscribe();
        if (scheduledNotification) clearTimeout(scheduledNotification);
      };
    },
    [queryClient]
  );
  const getUsingCachedData = useCallback(
    () =>
      queryClient
        .getQueryCache()
        .getAll()
        .some(
          (query) => !registry.isHouseholdQuery(query.queryKey) && queryHasRestoredActiveData(query)
        ),
    [queryClient, queryHasRestoredActiveData, registry]
  );
  const usingCachedData = useSyncExternalStore(
    subscribeToQueryCache,
    getUsingCachedData,
    () => false
  );
  const isQueryUsingCachedData = useCallback(
    (queryKey: QueryKey) => {
      const query = queryClient.getQueryCache().find({ queryKey, exact: true });

      return query ? queryHasRestoredActiveData(query) : false;
    },
    [queryClient, queryHasRestoredActiveData]
  );
  const getCachedQueryUpdatedAt = useCallback(
    (queryKey: QueryKey) => {
      if (!isQueryUsingCachedData(queryKey)) return null;

      return (
        queryClient.getQueryCache().find({ queryKey, exact: true })?.state.dataUpdatedAt ?? null
      );
    },
    [isQueryUsingCachedData, queryClient]
  );
  const hasResolvedQueryData = useCallback(
    (queryKey: QueryKey) =>
      queryClient.getQueryCache().find({ queryKey, exact: true })?.state.data !== undefined,
    [queryClient]
  );
  const isQueryUnavailable = useCallback(
    (queryKey: QueryKey) => checkQueryUnavailable(phase, queryKey),
    [checkQueryUnavailable, phase]
  );

  return useMemo<OfflineWebContextValue>(
    () => ({
      phase,
      activeScope: readCache.activeScope,
      inventory: readCache.inventory,
      persistenceWarning: readCache.persistenceWarning ?? readCache.inventory.persistenceWarning,
      renderUser: readCache.activeScope?.renderUser ?? null,
      renderIdentityOnly: !sessionUser && Boolean(readCache.activeScope),
      usingCachedData,
      visibleDataUnavailable,
      getCachedQueryUpdatedAt,
      hasResolvedQueryData,
      isQueryLoadingFallback: readCache.isQueryLoadingFallback,
      isQueryUsingCachedData,
      isQueryUnavailable,
      registerVisibleDataUnavailable,
      retryConnection: () => connectivityRuntime.recover(),
      clearCachedData: readCache.clearCachedData,
    }),
    [
      connectivityRuntime,
      getCachedQueryUpdatedAt,
      hasResolvedQueryData,
      isQueryUsingCachedData,
      isQueryUnavailable,
      phase,
      readCache.activeScope,
      readCache.clearCachedData,
      readCache.inventory,
      readCache.isQueryLoadingFallback,
      readCache.persistenceWarning,
      registerVisibleDataUnavailable,
      sessionUser,
      usingCachedData,
      visibleDataUnavailable,
    ]
  );
}
