import type { OfflineReadCacheRegistry } from "@/context/offline-web/shared";
import type { WebConnectivityRuntime } from "@/lib/connectivity";
import type {
  WebReadCachePersistenceWarning,
  WebReadCacheRepository,
  WebReadCacheScope,
} from "@/lib/offline-read-cache";
import type { Query, QueryClient } from "@tanstack/react-query";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useCallback, useEffect, useRef } from "react";
import { WRITE_THROTTLE_MS } from "@/context/offline-web/shared";
import {
  serializeWebReadCacheQueryKey,
  toWebReadCachePersistenceWarning,
} from "@/lib/offline-read-cache";

type ScheduledReadCacheWrite = {
  throttleKey: string;
  scope: WebReadCacheScope;
  descriptor: ReturnType<OfflineReadCacheRegistry["describe"]>;
  dataUpdatedAt: number;
};

type UseReadCachePersistenceOptions = {
  activeScopeRef: MutableRefObject<WebReadCacheScope | null>;
  cacheRepository: WebReadCacheRepository;
  connectivityRuntime: WebConnectivityRuntime;
  queryClient: QueryClient;
  refreshInventory: (scope?: WebReadCacheScope | null) => Promise<void>;
  registry: OfflineReadCacheRegistry;
  restoredQueryIdentitiesRef: MutableRefObject<Set<string>>;
  setPersistenceWarning: Dispatch<SetStateAction<WebReadCachePersistenceWarning | null>>;
};

export function useReadCachePersistence({
  activeScopeRef,
  cacheRepository,
  connectivityRuntime,
  queryClient,
  refreshInventory,
  registry,
  restoredQueryIdentitiesRef,
  setPersistenceWarning,
}: UseReadCachePersistenceOptions) {
  const writeTimersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const pendingWritesRef = useRef(new Map<string, ScheduledReadCacheWrite>());
  const lastWriteStartedAtRef = useRef(new Map<string, number>());
  const manuallyUpdatedQueryIdentitiesRef = useRef(new Set<string>());

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
        .then(async () => {
          setPersistenceWarning(null);
          await refreshInventory(write.scope);
        })
        .catch(async (error) => {
          setPersistenceWarning(toWebReadCachePersistenceWarning(error, write.descriptor?.kind));
          await refreshInventory(write.scope);
        });
    },
    [cacheRepository, refreshInventory, setPersistenceWarning]
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
    [activeScopeRef, commitScheduledWrite, connectivityRuntime, registry]
  );

  const persistExistingQueries = useCallback(() => {
    if (connectivityRuntime.isDegraded()) return;

    for (const query of queryClient.getQueryCache().getAll()) {
      const identity = serializeWebReadCacheQueryKey(query.queryKey);

      if (
        !restoredQueryIdentitiesRef.current.has(identity) &&
        !manuallyUpdatedQueryIdentitiesRef.current.has(identity)
      ) {
        persistQuery(query);
      }
    }
  }, [connectivityRuntime, persistQuery, queryClient, restoredQueryIdentitiesRef]);

  const recordSuccessfulQuery = useCallback(
    (query: Query, manual: boolean) => {
      const identity = serializeWebReadCacheQueryKey(query.queryKey);

      if (manual) {
        manuallyUpdatedQueryIdentitiesRef.current.add(identity);

        return;
      }

      manuallyUpdatedQueryIdentitiesRef.current.delete(identity);
      persistQuery(query);
    },
    [persistQuery]
  );

  useEffect(() => {
    const writeTimers = writeTimersRef.current;
    const pendingWrites = pendingWritesRef.current;
    const lastWriteStartedAt = lastWriteStartedAtRef.current;
    const manuallyUpdatedQueryIdentities = manuallyUpdatedQueryIdentitiesRef.current;

    return () => {
      for (const timer of writeTimers.values()) clearTimeout(timer);
      writeTimers.clear();
      pendingWrites.clear();
      lastWriteStartedAt.clear();
      manuallyUpdatedQueryIdentities.clear();
    };
  }, []);

  return { persistExistingQueries, recordSuccessfulQuery };
}
