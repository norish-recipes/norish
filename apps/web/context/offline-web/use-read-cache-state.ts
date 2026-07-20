import type { OfflineWebPhase } from "@/context/offline-web/shared";
import type {
  WebReadCachePersistenceWarning,
  WebReadCacheRepository,
  WebReadCacheScope,
} from "@/lib/offline-read-cache";
import type { Query, QueryClient, QueryKey } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { backendOrigin, EMPTY_INVENTORY } from "@/context/offline-web/shared";
import {
  getWebReadCacheConfirmedSignOutAt,
  isWebReadCacheScopeRestorable,
  serializeWebReadCacheQueryKey,
  toWebReadCachePersistenceWarning,
} from "@/lib/offline-read-cache";

type UseReadCacheStateOptions = {
  cacheRepository: WebReadCacheRepository;
  commitPhase: (phase: OfflineWebPhase) => void;
  liveUserId: string | null;
  queryClient: QueryClient;
};

export function useReadCacheState({
  cacheRepository,
  commitPhase,
  liveUserId,
  queryClient,
}: UseReadCacheStateOptions) {
  const [activeScope, setActiveScopeState] = useState<WebReadCacheScope | null>(null);
  const activeScopeRef = useRef<WebReadCacheScope | null>(null);
  const [inventory, setInventory] = useState(EMPTY_INVENTORY);
  const [persistenceWarning, setPersistenceWarning] =
    useState<WebReadCachePersistenceWarning | null>(null);
  const [restoredQueryCount, setRestoredQueryCount] = useState(0);
  const restoredQueryIdentitiesRef = useRef(new Set<string>());
  const cachedQueryIdentitiesRef = useRef(new Set<string>());
  const restoringQueryIdentitiesRef = useRef(new Set<string>());
  const preparedScopeRef = useRef<Promise<WebReadCacheScope | null> | null>(null);
  const fallbackPromiseRef = useRef<Promise<void> | null>(null);
  const restoreGenerationRef = useRef(0);
  const liveUserIdRef = useRef(liveUserId);
  const restoredQueryCountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  liveUserIdRef.current = liveUserId;

  useEffect(
    () => () => {
      if (restoredQueryCountTimerRef.current) {
        clearTimeout(restoredQueryCountTimerRef.current);
      }
    },
    []
  );

  const scheduleRestoredQueryCountSync = useCallback(() => {
    if (restoredQueryCountTimerRef.current) return;

    restoredQueryCountTimerRef.current = setTimeout(() => {
      restoredQueryCountTimerRef.current = null;
      setRestoredQueryCount(restoredQueryIdentitiesRef.current.size);
    }, 0);
  }, []);

  const setActiveScope = useCallback((scope: WebReadCacheScope | null) => {
    activeScopeRef.current = scope;
    setActiveScopeState(scope);
  }, []);

  const setRestoredQueries = useCallback((identities: Set<string>) => {
    restoredQueryIdentitiesRef.current = new Set(identities);
    setRestoredQueryCount(identities.size);
  }, []);

  const addRestoredQuery = useCallback(
    (identity: string) => {
      restoredQueryIdentitiesRef.current.add(identity);
      scheduleRestoredQueryCountSync();
    },
    [scheduleRestoredQueryCountSync]
  );

  const beginRestoringQuery = useCallback((identity: string): boolean => {
    if (restoringQueryIdentitiesRef.current.has(identity)) return false;

    restoringQueryIdentitiesRef.current.add(identity);

    return true;
  }, []);

  const finishRestoringQuery = useCallback((identity: string): boolean => {
    return restoringQueryIdentitiesRef.current.delete(identity);
  }, []);

  const isRestoringQuery = useCallback(
    (identity: string) => restoringQueryIdentitiesRef.current.has(identity),
    []
  );

  const forgetRestoredQueryData = useCallback(
    (identity: string) => {
      if (restoredQueryIdentitiesRef.current.delete(identity)) {
        scheduleRestoredQueryCountSync();
      }
    },
    [scheduleRestoredQueryCountSync]
  );

  const removeRestoredQuery = useCallback(
    (identity: string) => {
      cachedQueryIdentitiesRef.current.delete(identity);
      forgetRestoredQueryData(identity);
    },
    [forgetRestoredQueryData]
  );

  const evictRestoredQueries = useCallback(() => {
    const identities = restoredQueryIdentitiesRef.current;

    for (const query of queryClient.getQueryCache().getAll()) {
      if (!identities.has(serializeWebReadCacheQueryKey(query.queryKey))) continue;

      queryClient.removeQueries({ queryKey: query.queryKey, exact: true });
    }

    cachedQueryIdentitiesRef.current.clear();
    restoringQueryIdentitiesRef.current.clear();
    setRestoredQueries(new Set());
  }, [queryClient, setRestoredQueries]);

  const discardRestoredScope = useCallback(() => {
    restoreGenerationRef.current += 1;
    preparedScopeRef.current = Promise.resolve(null);
    evictRestoredQueries();
    setActiveScope(null);
    setInventory(EMPTY_INVENTORY);
  }, [evictRestoredQueries, setActiveScope]);

  const refreshInventory = useCallback(
    async (scope = activeScopeRef.current) => {
      const requestedScopeKey = scope?.key ?? null;

      try {
        const nextInventory = await cacheRepository.getInventory(requestedScopeKey);

        if ((activeScopeRef.current?.key ?? null) === requestedScopeKey) {
          setInventory(nextInventory);
        }
      } catch (error) {
        setPersistenceWarning(toWebReadCachePersistenceWarning(error));
      }
    },
    [cacheRepository]
  );

  const selectRestorableScope = useCallback(async () => {
    const origin = backendOrigin();
    const scope = await cacheRepository.selectLastConfirmedScope(origin);
    const confirmedSignOutAt = getWebReadCacheConfirmedSignOutAt(origin);

    if (!scope || isWebReadCacheScopeRestorable(scope, confirmedSignOutAt)) return scope;

    try {
      await cacheRepository.clearConfirmedRenderScope(origin, confirmedSignOutAt ?? undefined);
    } catch (error) {
      setPersistenceWarning(toWebReadCachePersistenceWarning(error));
    }

    return null;
  }, [cacheRepository]);

  const prepareScope = useCallback(() => {
    preparedScopeRef.current = selectRestorableScope().catch((error) => {
      setPersistenceWarning(toWebReadCachePersistenceWarning(error));

      return null;
    });
  }, [selectRestorableScope]);

  const restoreFallback = useCallback(() => {
    if (fallbackPromiseRef.current) return fallbackPromiseRef.current;

    fallbackPromiseRef.current = (async () => {
      const restoreGeneration = restoreGenerationRef.current;
      const rejectFallback = async () => {
        discardRestoredScope();
        commitPhase("unavailable");
        await refreshInventory(null);
      };

      commitPhase("loading-fallback");
      let scope: WebReadCacheScope | null = null;

      try {
        scope = preparedScopeRef.current
          ? await preparedScopeRef.current
          : await selectRestorableScope();
      } catch (error) {
        setPersistenceWarning(toWebReadCachePersistenceWarning(error));
      }

      if (!scope) {
        commitPhase("unavailable");
        await refreshInventory(null);

        return;
      }

      const restoreIsAllowed = () =>
        restoreGenerationRef.current === restoreGeneration &&
        (!liveUserIdRef.current || scope?.userId === liveUserIdRef.current);

      if (!restoreIsAllowed()) {
        await rejectFallback();

        return;
      }

      const records = await cacheRepository.listRecords(scope.key);

      if (!restoreIsAllowed()) {
        await rejectFallback();

        return;
      }

      const identities = new Set<string>();
      const fallbackIdentities = new Set<string>();
      let skippedForNewerLiveData = false;
      const restoreQueryData = (queryKey: QueryKey, data: unknown, updatedAt: number) => {
        const identity = serializeWebReadCacheQueryKey(queryKey);

        if (!beginRestoringQuery(identity)) return;

        try {
          queryClient.setQueryData(queryKey, data, { updatedAt });
          identities.add(identity);
        } finally {
          finishRestoringQuery(identity);
        }
      };

      for (const record of records) {
        const identity = serializeWebReadCacheQueryKey(record.queryKey);

        fallbackIdentities.add(identity);
        const liveQuery = queryClient
          .getQueryCache()
          .find({ queryKey: record.queryKey, exact: true });

        if (
          liveQuery?.state.data !== undefined &&
          liveQuery.state.dataUpdatedAt >= record.dataUpdatedAt
        ) {
          skippedForNewerLiveData = true;

          continue;
        }

        restoreQueryData(record.queryKey, record.data, record.dataUpdatedAt);
      }

      if (scope.householdQueryKey && scope.renderHousehold) {
        const householdIdentity = serializeWebReadCacheQueryKey(scope.householdQueryKey);

        fallbackIdentities.add(householdIdentity);
        const liveHouseholdQuery = queryClient
          .getQueryCache()
          .find({ queryKey: scope.householdQueryKey, exact: true });

        if (liveHouseholdQuery?.state.data !== undefined) {
          skippedForNewerLiveData = true;
        } else {
          restoreQueryData(
            scope.householdQueryKey,
            { household: scope.renderHousehold, currentUserId: scope.userId },
            scope.confirmedAt
          );
        }
      }

      cachedQueryIdentitiesRef.current = fallbackIdentities;
      setActiveScope(scope);
      setRestoredQueries(identities);
      await refreshInventory(scope);

      if (!restoreIsAllowed()) {
        await rejectFallback();

        return;
      }

      commitPhase(
        identities.size > 0 ? "cached" : skippedForNewerLiveData ? "live" : "unavailable"
      );
    })().finally(() => {
      fallbackPromiseRef.current = null;
    });

    return fallbackPromiseRef.current;
  }, [
    cacheRepository,
    beginRestoringQuery,
    commitPhase,
    discardRestoredScope,
    finishRestoringQuery,
    queryClient,
    refreshInventory,
    selectRestorableScope,
    setActiveScope,
    setRestoredQueries,
  ]);

  const pruneInactiveRestoredQueries = useCallback(() => {
    const activeRestoredQueries = new Set<string>();

    for (const query of [...queryClient.getQueryCache().getAll()]) {
      const identity = serializeWebReadCacheQueryKey(query.queryKey);

      if (!restoredQueryIdentitiesRef.current.has(identity)) continue;

      if (query.isActive()) {
        activeRestoredQueries.add(identity);

        continue;
      }

      queryClient.removeQueries({ queryKey: query.queryKey, exact: true });
    }

    setRestoredQueries(activeRestoredQueries);
  }, [queryClient, setRestoredQueries]);

  const restoreQueryFromCache = useCallback(
    (query: Query) => {
      const identity = serializeWebReadCacheQueryKey(query.queryKey);
      const scope = activeScopeRef.current;

      if (
        !scope ||
        query.state.data !== undefined ||
        !cachedQueryIdentitiesRef.current.has(identity) ||
        !beginRestoringQuery(identity)
      ) {
        return;
      }

      const scopeKey = scope.key;

      void (async () => {
        try {
          const currentScope = activeScopeRef.current;

          if (currentScope?.key !== scopeKey) return;

          let data: unknown;
          let updatedAt: number;

          if (
            scope.householdQueryKey &&
            scope.renderHousehold &&
            serializeWebReadCacheQueryKey(scope.householdQueryKey) === identity
          ) {
            data = { household: scope.renderHousehold, currentUserId: scope.userId };
            updatedAt = scope.confirmedAt;
          } else {
            const record = await cacheRepository.getRecord(scopeKey, query.queryKey);

            if (!record) {
              cachedQueryIdentitiesRef.current.delete(identity);
              forgetRestoredQueryData(identity);

              return;
            }

            data = record.data;
            updatedAt = record.dataUpdatedAt;
          }

          if (
            activeScopeRef.current?.key !== scopeKey ||
            !cachedQueryIdentitiesRef.current.has(identity)
          ) {
            return;
          }

          const currentQuery = queryClient
            .getQueryCache()
            .find({ queryKey: query.queryKey, exact: true });

          if (currentQuery?.state.data !== undefined) return;

          addRestoredQuery(identity);
          queryClient.setQueryData(query.queryKey, data, { updatedAt });
        } catch (error) {
          setPersistenceWarning(toWebReadCachePersistenceWarning(error));
        } finally {
          finishRestoringQuery(identity);
        }
      })();
    },
    [
      addRestoredQuery,
      beginRestoringQuery,
      cacheRepository,
      finishRestoringQuery,
      forgetRestoredQueryData,
      queryClient,
    ]
  );

  const clearCachedData = useCallback(async () => {
    const scope = activeScopeRef.current;

    if (!scope) return;

    await cacheRepository.clearScope(scope.key);
    evictRestoredQueries();
    await refreshInventory(scope);
  }, [cacheRepository, evictRestoredQueries, refreshInventory]);

  const isQueryUnavailable = useCallback(
    (phase: OfflineWebPhase, queryKey: QueryKey) => {
      if (phase !== "cached" && phase !== "unavailable") {
        return false;
      }

      const identity = serializeWebReadCacheQueryKey(queryKey);
      const query = queryClient.getQueryCache().find({ queryKey, exact: true });

      if (cachedQueryIdentitiesRef.current.has(identity)) return false;
      if (restoredQueryIdentitiesRef.current.has(identity) && query?.state.data !== undefined) {
        return false;
      }

      return query?.state.data === undefined;
    },
    [queryClient]
  );

  const isQueryLoadingFallback = useCallback(
    (queryKey: QueryKey) => {
      const identity = serializeWebReadCacheQueryKey(queryKey);
      const query = queryClient.getQueryCache().find({ queryKey, exact: true });

      return cachedQueryIdentitiesRef.current.has(identity) && query?.state.data === undefined;
    },
    [queryClient]
  );

  return {
    activeScope,
    activeScopeRef,
    clearCachedData,
    discardRestoredScope,
    forgetRestoredQueryData,
    inventory,
    isQueryLoadingFallback,
    isRestoringQuery,
    isQueryUnavailable,
    persistenceWarning,
    prepareScope,
    preparedScopeRef,
    pruneInactiveRestoredQueries,
    refreshInventory,
    removeRestoredQuery,
    restoredQueryCount,
    restoredQueryIdentitiesRef,
    restoreQueryFromCache,
    restoreFallback,
    setActiveScope,
    setPersistenceWarning,
    setRestoredQueries,
  };
}
