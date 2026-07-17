"use client";

import type { Query, QueryKey } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { useQueryClient } from "@tanstack/react-query";

import type { User } from "@norish/shared/contracts";
import { getSession, useSession } from "@norish/shared/lib/auth/client";

import type { WebConnectivityRuntime } from "../lib/connectivity";
import type {
  WebReadCacheInventory,
  WebReadCachePersistenceWarning,
  WebReadCacheScope,
} from "../lib/offline-read-cache";
import { useWebConnectivityRuntime, webConnectivityRuntime } from "../lib/connectivity";
import {
  serializeWebReadCacheQueryKey,
  subscribeToWebReadCacheChanges,
  toWebReadCachePersistenceWarning,
  WEB_READ_CACHE_SCHEMA_VERSION,
  WebReadCacheRepository,
} from "../lib/offline-read-cache";
import { createOfflineReadCacheRegistry } from "../lib/offline-read-cache/query-registry";

export type OfflineWebPhase =
  | "probing-live"
  | "loading-fallback"
  | "cached"
  | "unavailable"
  | "recovering"
  | "live";

type OfflineWebContextValue = {
  phase: OfflineWebPhase;
  activeScope: WebReadCacheScope | null;
  inventory: WebReadCacheInventory;
  persistenceWarning: WebReadCachePersistenceWarning | null;
  renderUser: User | null;
  renderIdentityOnly: boolean;
  usingCachedData: boolean;
  isQueryUnavailable: (queryKey: QueryKey) => boolean;
  retryConnection: () => Promise<boolean>;
  clearCachedData: () => Promise<void>;
};

type ScheduledReadCacheWrite = {
  throttleKey: string;
  scope: WebReadCacheScope;
  descriptor: ReturnType<ReturnType<typeof createOfflineReadCacheRegistry>["describe"]>;
  dataUpdatedAt: number;
};

const EMPTY_INVENTORY: WebReadCacheInventory = {
  scopeKey: null,
  schemaVersion: WEB_READ_CACHE_SCHEMA_VERSION,
  lastLiveSuccessAt: null,
  persistenceWarning: null,
  recipeSummaries: { count: 0, dataUpdatedAt: null, persistedAt: null },
  recipeDetails: { count: 0, dataUpdatedAt: null, persistedAt: null },
  calendarItems: { count: 0, dataUpdatedAt: null, persistedAt: null },
  groceries: { count: 0, dataUpdatedAt: null, persistedAt: null },
  recurringGroceries: { count: 0, dataUpdatedAt: null, persistedAt: null },
  stores: { count: 0, dataUpdatedAt: null, persistedAt: null },
  totalRecords: 0,
};

const OfflineWebContext = createContext<OfflineWebContextValue | null>(null);
const repository = new WebReadCacheRepository();
const FALLBACK_DEADLINE_MS = 2_500;
const WRITE_THROTTLE_MS = 250;
const OUTBOX_REPLAY_SETTLED_EVENT = "norish:web-outbox-replay-settled";

function backendOrigin(): string {
  return typeof window === "undefined" ? "" : window.location.origin;
}

function userFromSession(sessionUser: {
  id: string;
  email: string;
  name: string;
  image?: string | null;
}): User {
  return {
    id: sessionUser.id,
    email: sessionUser.email,
    name: sessionUser.name,
    image: sessionUser.image ?? null,
    version: 1,
  };
}

function getHouseholdId(data: unknown, userId: string): string | null {
  if (!data || typeof data !== "object") return null;

  const household = (data as { household?: unknown }).household;

  if (household && typeof household === "object" && "id" in household) {
    const id = (household as { id?: unknown }).id;

    if (typeof id === "string") return id;
  }

  return `user:${userId}`;
}

function getRenderHousehold(data: unknown): WebReadCacheScope["renderHousehold"] {
  if (!data || typeof data !== "object") return null;

  const household = (data as { household?: unknown }).household;

  if (!household || typeof household !== "object") return null;

  const value = household as Record<string, unknown>;

  return typeof value.id === "string" && typeof value.name === "string"
    ? ({ ...value, id: value.id, name: value.name } as WebReadCacheScope["renderHousehold"])
    : null;
}

export type OfflineWebProviderProps = {
  children: ReactNode;
  cacheRepository?: WebReadCacheRepository;
  connectivityRuntime?: WebConnectivityRuntime;
  fallbackDeadlineMs?: number;
};

export function OfflineWebProvider({
  children,
  cacheRepository = repository,
  connectivityRuntime = webConnectivityRuntime,
  fallbackDeadlineMs = FALLBACK_DEADLINE_MS,
}: OfflineWebProviderProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const session = useSession();
  const sessionUser = session.data?.user;
  const sessionPending = session.isPending;
  const sessionError = session.error;
  const connectivity = useWebConnectivityRuntime(connectivityRuntime);
  const registry = useMemo(() => createOfflineReadCacheRegistry(trpc), [trpc]);
  const [phase, setPhase] = useState<OfflineWebPhase>("probing-live");
  const phaseRef = useRef<OfflineWebPhase>("probing-live");
  const [activeScope, setActiveScope] = useState<WebReadCacheScope | null>(null);
  const activeScopeRef = useRef<WebReadCacheScope | null>(null);
  const [inventory, setInventory] = useState<WebReadCacheInventory>(EMPTY_INVENTORY);
  const [persistenceWarning, setPersistenceWarning] =
    useState<WebReadCachePersistenceWarning | null>(null);
  const [restoredQueries, setRestoredQueries] = useState<Set<string>>(() => new Set());
  const restoredQueryIdentitiesRef = useRef(new Set<string>());
  const restoringQueryIdentitiesRef = useRef(new Set<string>());
  const preparedScopeRef = useRef<Promise<WebReadCacheScope | null> | null>(null);
  const fallbackPromiseRef = useRef<Promise<void> | null>(null);
  const writeTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const pendingWritesRef = useRef(new Map<string, ScheduledReadCacheWrite>());
  const lastWriteStartedAtRef = useRef(new Map<string, number>());
  const liveUserRef = useRef<User | null>(null);
  const previousLiveUserIdRef = useRef<string | null>(null);

  const commitPhase = useCallback((next: OfflineWebPhase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const refreshInventory = useCallback(
    async (scope = activeScopeRef.current) => {
      try {
        setInventory(await cacheRepository.getInventory(scope?.key ?? null));
      } catch (error) {
        setPersistenceWarning(toWebReadCachePersistenceWarning(error));
      }
    },
    [cacheRepository]
  );

  const commitScheduledWrite = useCallback(
    (write: ScheduledReadCacheWrite) => {
      if (!write.descriptor) return;

      lastWriteStartedAtRef.current.set(write.throttleKey, Date.now());
      void cacheRepository
        .putRecord({
          scopeKey: write.scope.key,
          kind: write.descriptor.kind,
          queryKey: write.descriptor.queryKey,
          data: write.descriptor.data,
          dataUpdatedAt: write.dataUpdatedAt,
          counts: write.descriptor.counts,
        })
        .then(() => refreshInventory(write.scope))
        .catch((error) => setPersistenceWarning(toWebReadCachePersistenceWarning(error)));
    },
    [cacheRepository, refreshInventory]
  );

  const persistQuery = useCallback(
    (query: Query) => {
      if (connectivityRuntime.isDegraded()) return;

      const scope = activeScopeRef.current;
      const descriptor = registry.describe(query);

      if (!scope || !descriptor) return;

      const queryIdentity = serializeWebReadCacheQueryKey(descriptor.queryKey);
      const throttleKey = `${scope.key}:${queryIdentity}`;
      const write: ScheduledReadCacheWrite = {
        throttleKey,
        scope,
        descriptor,
        dataUpdatedAt: query.state.dataUpdatedAt,
      };
      const lastWriteStartedAt = lastWriteStartedAtRef.current.get(throttleKey) ?? 0;
      const remainingDelay = WRITE_THROTTLE_MS - (Date.now() - lastWriteStartedAt);

      if (remainingDelay <= 0 && !writeTimersRef.current.has(throttleKey)) {
        pendingWritesRef.current.delete(throttleKey);
        commitScheduledWrite(write);

        return;
      }

      pendingWritesRef.current.set(throttleKey, write);
      if (writeTimersRef.current.has(throttleKey)) return;

      writeTimersRef.current.set(
        throttleKey,
        setTimeout(
          () => {
            writeTimersRef.current.delete(throttleKey);
            const pending = pendingWritesRef.current.get(throttleKey);

            pendingWritesRef.current.delete(throttleKey);
            if (pending) commitScheduledWrite(pending);
          },
          Math.max(0, remainingDelay)
        )
      );
    },
    [commitScheduledWrite, connectivityRuntime, registry]
  );

  const persistExistingQueries = useCallback(() => {
    if (connectivityRuntime.isDegraded()) return;

    for (const query of queryClient.getQueryCache().getAll()) {
      const identity = serializeWebReadCacheQueryKey(query.queryKey);

      if (!restoredQueryIdentitiesRef.current.has(identity)) persistQuery(query);
    }
  }, [connectivityRuntime, persistQuery, queryClient]);

  const confirmScopeFromHousehold = useCallback(
    async (query: Query) => {
      if (connectivityRuntime.isDegraded()) return;

      const user = liveUserRef.current;

      if (!user || !registry.isHouseholdQuery(query.queryKey) || query.state.status !== "success") {
        return;
      }

      const householdId = getHouseholdId(query.state.data, user.id);

      if (!householdId) return;

      try {
        const scope = await cacheRepository.confirmScope({
          backendOrigin: backendOrigin(),
          userId: user.id,
          householdId,
          renderUser: user,
          renderHousehold: getRenderHousehold(query.state.data),
          householdQueryKey: query.queryKey,
          lastLiveSuccessAt: Math.max(connectivity.lastSuccessAt ?? 0, query.state.dataUpdatedAt),
        });

        activeScopeRef.current = scope;
        setActiveScope(scope);
        setPersistenceWarning(null);
        await refreshInventory(scope);
        persistExistingQueries();
      } catch (error) {
        setPersistenceWarning(toWebReadCachePersistenceWarning(error));
      }
    },
    [
      cacheRepository,
      connectivity.lastSuccessAt,
      connectivityRuntime,
      persistExistingQueries,
      refreshInventory,
      registry,
    ]
  );

  const restoreFallback = useCallback(() => {
    if (fallbackPromiseRef.current) return fallbackPromiseRef.current;

    fallbackPromiseRef.current = (async () => {
      if (phaseRef.current === "live") return;

      const restoreStartedAt = Date.now();
      commitPhase("loading-fallback");
      let scope: WebReadCacheScope | null = null;

      try {
        scope = await (preparedScopeRef.current ??
          cacheRepository.selectLastConfirmedScope(backendOrigin()));
      } catch (error) {
        setPersistenceWarning(toWebReadCachePersistenceWarning(error));
      }

      if (!scope) {
        commitPhase("unavailable");
        await refreshInventory(null);

        return;
      }

      activeScopeRef.current = scope;
      setActiveScope(scope);
      const records = await cacheRepository.listRecords(scope.key);
      const identities = new Set<string>();

      for (const record of records) {
        const liveQuery = queryClient
          .getQueryCache()
          .find({ queryKey: record.queryKey, exact: true });

        if (
          liveQuery?.state.status === "success" &&
          liveQuery.state.dataUpdatedAt >= restoreStartedAt
        ) {
          continue;
        }

        restoringQueryIdentitiesRef.current.add(record.queryIdentity);
        queryClient.setQueryData(record.queryKey, record.data, { updatedAt: record.dataUpdatedAt });
        identities.add(record.queryIdentity);
      }

      if (scope.householdQueryKey && scope.renderHousehold) {
        const householdIdentity = serializeWebReadCacheQueryKey(scope.householdQueryKey);

        restoringQueryIdentitiesRef.current.add(householdIdentity);
        queryClient.setQueryData(
          scope.householdQueryKey,
          { household: scope.renderHousehold, currentUserId: scope.userId },
          { updatedAt: scope.confirmedAt }
        );
        identities.add(householdIdentity);
      }

      restoredQueryIdentitiesRef.current = new Set(identities);
      setRestoredQueries(identities);
      await refreshInventory(scope);
      commitPhase(records.length > 0 ? "cached" : "unavailable");
    })().finally(() => {
      fallbackPromiseRef.current = null;
    });

    return fallbackPromiseRef.current;
  }, [cacheRepository, commitPhase, queryClient, refreshInventory]);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    document.documentElement.dataset.norishOfflineShellHydrated = "true";

    try {
      sessionStorage.removeItem(
        `norish:web-offline-shell-reload:${window.location.pathname}${window.location.search}`
      );
    } catch {
      // A storage-denied browser can still use the hydrated application normally.
    }
  }, []);

  useEffect(() => {
    preparedScopeRef.current = cacheRepository
      .selectLastConfirmedScope(backendOrigin())
      .catch((error) => {
        setPersistenceWarning(toWebReadCachePersistenceWarning(error));

        return null;
      });

    return connectivityRuntime.start(async () => {
      const result = await getSession();

      return !result.error;
    });
  }, [cacheRepository, connectivityRuntime]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (phaseRef.current === "probing-live") void restoreFallback();
    }, fallbackDeadlineMs);

    return () => window.clearTimeout(timeout);
  }, [fallbackDeadlineMs, restoreFallback]);

  useEffect(() => {
    if (connectivity.state === "online") {
      if (phaseRef.current === "probing-live") commitPhase("live");
      else if (
        phaseRef.current === "cached" ||
        phaseRef.current === "unavailable" ||
        phaseRef.current === "loading-fallback"
      ) {
        commitPhase("recovering");
      }

      return;
    }

    if (connectivity.state === "offline" || connectivity.state === "backend-unreachable") {
      if (phaseRef.current === "probing-live") void restoreFallback();
      else if (phaseRef.current === "recovering") {
        commitPhase(restoredQueries.size > 0 ? "cached" : "unavailable");
      }
    }
  }, [commitPhase, connectivity.state, restoreFallback, restoredQueries.size]);

  useEffect(() => {
    if (
      connectivity.state === "online" &&
      phaseRef.current === "recovering" &&
      restoredQueries.size === 0
    ) {
      commitPhase("live");
    }
  }, [commitPhase, connectivity.state, restoredQueries.size]);

  useEffect(() => {
    const liveUser = sessionUser && !sessionError ? userFromSession(sessionUser) : null;
    const previousUserId = previousLiveUserIdRef.current;

    liveUserRef.current = liveUser;

    if (liveUser && previousUserId && previousUserId !== liveUser.id) {
      queryClient.removeQueries({ queryKey: registry.householdQueryKey, exact: true });
      activeScopeRef.current = null;
      setActiveScope(null);
      restoredQueryIdentitiesRef.current = new Set();
      setRestoredQueries(new Set());
    }

    previousLiveUserIdRef.current = liveUser?.id ?? null;

    if (!sessionPending && !sessionError && !liveUser) {
      void cacheRepository.clearConfirmedRenderScope(backendOrigin(), Date.now());
      activeScopeRef.current = null;
      setActiveScope(null);
      restoredQueryIdentitiesRef.current = new Set();
      setRestoredQueries(new Set());
    }

    if (liveUser) {
      const householdQuery = queryClient.getQueryCache().find({
        queryKey: registry.householdQueryKey,
        exact: true,
      });

      if (householdQuery) void confirmScopeFromHousehold(householdQuery);
    }
  }, [
    confirmScopeFromHousehold,
    cacheRepository,
    queryClient,
    registry.householdQueryKey,
    sessionError,
    sessionPending,
    sessionUser,
  ]);

  useEffect(() => {
    return queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== "updated" || event.action.type !== "success") return;

      const identity = serializeWebReadCacheQueryKey(event.query.queryKey);

      if (restoringQueryIdentitiesRef.current.delete(identity)) return;
      if (connectivityRuntime.isDegraded()) return;

      restoredQueryIdentitiesRef.current.delete(identity);

      setRestoredQueries((current) => {
        if (!current.has(identity)) return current;

        const next = new Set(current);

        next.delete(identity);

        return next;
      });
      void confirmScopeFromHousehold(event.query);
      persistQuery(event.query);
    });
  }, [confirmScopeFromHousehold, connectivityRuntime, persistQuery, queryClient]);

  useEffect(() => {
    const unsubscribe = subscribeToWebReadCacheChanges(() => void refreshInventory());
    const settled = () => commitPhase("live");

    window.addEventListener(OUTBOX_REPLAY_SETTLED_EVENT, settled);

    return () => {
      unsubscribe();
      window.removeEventListener(OUTBOX_REPLAY_SETTLED_EVENT, settled);
    };
  }, [commitPhase, refreshInventory]);

  useEffect(() => {
    return () => {
      for (const timer of writeTimersRef.current.values()) clearTimeout(timer);
      writeTimersRef.current.clear();
      pendingWritesRef.current.clear();
      lastWriteStartedAtRef.current.clear();
    };
  }, []);

  const clearCachedData = useCallback(async () => {
    const scope = activeScopeRef.current;

    if (!scope) return;

    await cacheRepository.clearScope(scope.key);
    restoredQueryIdentitiesRef.current = new Set();
    setRestoredQueries(new Set());
    await refreshInventory(scope);
  }, [cacheRepository, refreshInventory]);

  const isQueryUnavailable = useCallback(
    (queryKey: QueryKey) => {
      if (phase !== "cached" && phase !== "unavailable" && phase !== "loading-fallback") {
        return false;
      }

      return !restoredQueries.has(serializeWebReadCacheQueryKey(queryKey));
    },
    [phase, restoredQueries]
  );

  const value = useMemo<OfflineWebContextValue>(
    () => ({
      phase,
      activeScope,
      inventory,
      persistenceWarning: persistenceWarning ?? inventory.persistenceWarning,
      renderUser: activeScope?.renderUser ?? null,
      renderIdentityOnly: !sessionUser && Boolean(activeScope),
      usingCachedData: restoredQueries.size > 0,
      isQueryUnavailable,
      retryConnection: () => connectivityRuntime.recover(),
      clearCachedData,
    }),
    [
      activeScope,
      clearCachedData,
      connectivityRuntime,
      inventory,
      isQueryUnavailable,
      persistenceWarning,
      phase,
      restoredQueries.size,
      sessionUser,
    ]
  );

  return <OfflineWebContext.Provider value={value}>{children}</OfflineWebContext.Provider>;
}

export function useOfflineWeb(): OfflineWebContextValue {
  const context = useContext(OfflineWebContext);

  if (!context) throw new Error("useOfflineWeb must be used within OfflineWebProvider");

  return context;
}

export function useOfflineRenderUser(): {
  user: User | null;
  isRenderOnly: boolean;
} {
  const { renderUser, renderIdentityOnly } = useOfflineWeb();

  return { user: renderUser, isRenderOnly: renderIdentityOnly };
}
