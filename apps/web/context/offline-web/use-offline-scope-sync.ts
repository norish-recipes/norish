import type { LiveSessionUser, OfflineReadCacheRegistry } from "@/context/offline-web/shared";
import type { WebConnectivityRuntime } from "@/lib/connectivity";
import type {
  WebReadCachePersistenceWarning,
  WebReadCacheRepository,
  WebReadCacheScope,
} from "@/lib/offline-read-cache";
import type { Query, QueryClient } from "@tanstack/react-query";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  backendOrigin,
  getHouseholdId,
  getRenderHousehold,
  userFromSession,
} from "@/context/offline-web/shared";
import { confirmWebSessionSignedOut } from "@/lib/connectivity";
import {
  getWebReadCacheConfirmedSignOutAt,
  recordWebReadCacheConfirmedSignOut,
  toWebReadCachePersistenceWarning,
} from "@/lib/offline-read-cache";

import type { User } from "@norish/shared/contracts";

type UseOfflineScopeSyncOptions = {
  activeScopeRef: MutableRefObject<WebReadCacheScope | null>;
  cacheRepository: WebReadCacheRepository;
  connectivityLastSuccessAt: number | null;
  connectivityRuntime: WebConnectivityRuntime;
  discardRestoredScope: () => void;
  persistExistingQueries: () => void;
  preparedScopeRef: MutableRefObject<Promise<WebReadCacheScope | null> | null>;
  queryClient: QueryClient;
  refreshInventory: (scope?: WebReadCacheScope | null) => Promise<void>;
  registry: OfflineReadCacheRegistry;
  sessionError: unknown;
  sessionPending: boolean;
  sessionUser: LiveSessionUser | undefined;
  setActiveScope: (scope: WebReadCacheScope | null) => void;
  setPersistenceWarning: Dispatch<SetStateAction<WebReadCachePersistenceWarning | null>>;
};

export function useOfflineScopeSync({
  activeScopeRef,
  cacheRepository,
  connectivityLastSuccessAt,
  connectivityRuntime,
  discardRestoredScope,
  persistExistingQueries,
  preparedScopeRef,
  queryClient,
  refreshInventory,
  registry,
  sessionError,
  sessionPending,
  sessionUser,
  setActiveScope,
  setPersistenceWarning,
}: UseOfflineScopeSyncOptions) {
  const liveUserRef = useRef<User | null>(null);
  const previousLiveUserIdRef = useRef<string | null>(null);
  const sessionGenerationRef = useRef(0);
  const observedScopeIdentityRef = useRef<{ userId: string; householdId: string } | null>(null);
  const nextLiveUser = useMemo(
    () => (sessionUser && !sessionError ? userFromSession(sessionUser) : null),
    [sessionError, sessionUser]
  );

  useLayoutEffect(() => {
    if ((liveUserRef.current?.id ?? null) !== (nextLiveUser?.id ?? null)) {
      sessionGenerationRef.current += 1;
      observedScopeIdentityRef.current = null;
    }

    liveUserRef.current = nextLiveUser;
  }, [nextLiveUser]);

  const removeUserScopedQueries = useCallback(
    (preservedHouseholdQuery?: Query) => {
      const predicate = (query: Query) =>
        query !== preservedHouseholdQuery &&
        (registry.isHouseholdQuery(query.queryKey) ||
          registry.classifyForPersistence(query) !== null);

      queryClient.removeQueries({ predicate, type: "inactive" });
      void queryClient.resetQueries({ predicate, type: "active" });
    },
    [queryClient, registry]
  );

  const confirmScopeFromHousehold = useCallback(
    async function confirmScopeFromHouseholdQuery(query: Query) {
      if (connectivityRuntime.isDegraded()) return;

      const user = liveUserRef.current;
      const sessionGeneration = sessionGenerationRef.current;

      if (!user || !registry.isHouseholdQuery(query.queryKey) || query.state.status !== "success") {
        return;
      }

      const currentHouseholdQuery = queryClient.getQueryCache().find({
        queryKey: registry.householdQueryKey,
        exact: true,
      });

      if (currentHouseholdQuery !== query) return;

      const queryData = query.state.data;
      const queryDataUpdatedAt = query.state.dataUpdatedAt;
      const householdId = getHouseholdId(queryData, user.id);
      const queryUserId =
        queryData && typeof queryData === "object" && "currentUserId" in queryData
          ? (queryData as { currentUserId?: unknown }).currentUserId
          : null;

      if (!householdId || (typeof queryUserId === "string" && queryUserId !== user.id)) return;

      const previousScopeIdentity =
        observedScopeIdentityRef.current?.userId === user.id
          ? observedScopeIdentityRef.current
          : activeScopeRef.current?.userId === user.id
            ? activeScopeRef.current
            : null;
      const householdChanged =
        previousScopeIdentity !== null && previousScopeIdentity.householdId !== householdId;

      observedScopeIdentityRef.current = { userId: user.id, householdId };

      if (householdChanged) {
        removeUserScopedQueries(query);
        discardRestoredScope();
      }

      const confirmationIsCurrent = () => {
        const latestHouseholdQuery = queryClient.getQueryCache().find({
          queryKey: registry.householdQueryKey,
          exact: true,
        });

        return (
          sessionGenerationRef.current === sessionGeneration &&
          liveUserRef.current?.id === user.id &&
          latestHouseholdQuery === query &&
          latestHouseholdQuery.state.status === "success" &&
          latestHouseholdQuery.state.data === queryData &&
          latestHouseholdQuery.state.dataUpdatedAt === queryDataUpdatedAt &&
          getHouseholdId(latestHouseholdQuery.state.data, user.id) === householdId
        );
      };
      const retryCurrentConfirmation = () => {
        const currentUser = liveUserRef.current;
        const currentHouseholdQuery = queryClient.getQueryCache().find({
          queryKey: registry.householdQueryKey,
          exact: true,
        });

        if (
          currentUser &&
          currentHouseholdQuery &&
          currentHouseholdQuery.state.status === "success"
        ) {
          void Promise.resolve().then(() => confirmScopeFromHouseholdQuery(currentHouseholdQuery));
        }
      };

      try {
        const origin = backendOrigin();
        const confirmedSignOutAt = getWebReadCacheConfirmedSignOutAt(origin);
        const scope = await cacheRepository.confirmScope({
          backendOrigin: origin,
          userId: user.id,
          householdId,
          renderUser: user,
          renderHousehold: getRenderHousehold(queryData),
          householdQueryKey: query.queryKey,
          confirmedAt: Math.max(Date.now(), (confirmedSignOutAt ?? 0) + 1),
          lastLiveSuccessAt: Math.max(connectivityLastSuccessAt ?? 0, query.state.dataUpdatedAt),
        });

        if (!confirmationIsCurrent()) {
          await cacheRepository.deactivateScope(scope.key, scope.confirmedAt);
          retryCurrentConfirmation();

          return;
        }

        setActiveScope(scope);
        preparedScopeRef.current = Promise.resolve(scope);
        setPersistenceWarning(null);
        await refreshInventory(scope);

        if (!confirmationIsCurrent()) {
          await cacheRepository.deactivateScope(scope.key, scope.confirmedAt);

          if (
            activeScopeRef.current?.key === scope.key &&
            activeScopeRef.current.confirmedAt === scope.confirmedAt
          ) {
            discardRestoredScope();
          }

          retryCurrentConfirmation();

          return;
        }

        persistExistingQueries();
      } catch (error) {
        setPersistenceWarning(toWebReadCachePersistenceWarning(error));
      }
    },
    [
      cacheRepository,
      connectivityLastSuccessAt,
      connectivityRuntime,
      discardRestoredScope,
      persistExistingQueries,
      preparedScopeRef,
      queryClient,
      refreshInventory,
      removeUserScopedQueries,
      registry,
      activeScopeRef,
      setActiveScope,
      setPersistenceWarning,
    ]
  );

  useEffect(() => {
    const liveUser = nextLiveUser;
    const previousUserId = previousLiveUserIdRef.current;
    const activeScopeUserId = activeScopeRef.current?.userId ?? null;
    let cancelled = false;

    if (
      liveUser &&
      ((previousUserId && previousUserId !== liveUser.id) ||
        (activeScopeUserId && activeScopeUserId !== liveUser.id))
    ) {
      removeUserScopedQueries();
      discardRestoredScope();
    }

    if (liveUser) {
      previousLiveUserIdRef.current = liveUser.id;
    } else if (!sessionPending && !sessionError && !connectivityRuntime.isDegraded()) {
      void confirmWebSessionSignedOut().then(async (confirmed) => {
        if (!confirmed || cancelled || connectivityRuntime.isDegraded()) return;

        previousLiveUserIdRef.current = null;
        removeUserScopedQueries();
        discardRestoredScope();
        const confirmedSignOutAt = Date.now();

        recordWebReadCacheConfirmedSignOut(backendOrigin(), confirmedSignOutAt);

        try {
          await cacheRepository.clearConfirmedRenderScope(backendOrigin(), confirmedSignOutAt);
        } catch (error) {
          if (!cancelled) setPersistenceWarning(toWebReadCachePersistenceWarning(error));
        }

        if (!cancelled) await refreshInventory(null);
      });
    }

    if (liveUser) {
      const householdQuery = queryClient.getQueryCache().find({
        queryKey: registry.householdQueryKey,
        exact: true,
      });

      if (householdQuery) void confirmScopeFromHousehold(householdQuery);
    }

    return () => {
      cancelled = true;
    };
  }, [
    activeScopeRef,
    cacheRepository,
    confirmScopeFromHousehold,
    connectivityRuntime,
    discardRestoredScope,
    queryClient,
    refreshInventory,
    removeUserScopedQueries,
    registry.householdQueryKey,
    nextLiveUser,
    sessionError,
    sessionPending,
    sessionUser,
    setPersistenceWarning,
  ]);

  return { confirmScopeFromHousehold };
}
