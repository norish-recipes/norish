import { useEffect, useRef } from "react";
import { useNetworkStatus } from "@/context/network-context";
import { drainQueue } from "@/lib/outbox";
import { queryCacheStorage } from "@/lib/storage/query-cache-mmkv";
import { persistedQueryClient } from "@/providers/trpc-provider";

import { createClientLogger } from "@norish/shared/lib/logger";

const log = createClientLogger("cache-lifecycle");

async function refreshQueriesAfterReconnect(): Promise<void> {
  log.info("Clearing persisted query cache and resetting queries");
  queryCacheStorage.clearAll();
  await persistedQueryClient.resetQueries();
}

/**
 * Watches `appOnline` transitions and refreshes query state when the backend
 * becomes reachable again. The outbox replay is attempted first; after that
 * attempt completes, query caches are cleared/reset so the UI refetches fresh
 * data whether or not the outbox fully drained.
 */
export function useCacheInvalidationOnReconnect() {
  const { appOnline } = useNetworkStatus();
  const prevAppOnlineRef = useRef(appOnline);

  useEffect(() => {
    const wasOffline = !prevAppOnlineRef.current;

    prevAppOnlineRef.current = appOnline;

    if (wasOffline && appOnline) {
      log.info("App back online — draining outbox before refreshing queries");
      void drainQueue()
        .then((result) => {
          if (!result.hadPendingItems) {
            log.info("Outbox empty on reconnect");
            return;
          }

          if (result.drained) {
            log.info("Outbox drained successfully on reconnect");
            return;
          }

          log.warn(
            {
              pendingItems: result.pendingItems,
              scheduledRetryAt: result.scheduledRetryAt,
            },
            "Outbox replay finished with pending items; refreshing caches anyway"
          );
        })
        .catch((error) => {
          log.warn({ error }, "Outbox replay failed during reconnect");
        })
        .finally(() => {
          void refreshQueriesAfterReconnect().catch((error) => {
            log.warn({ error }, "Failed to refresh query caches after reconnect");
          });
        });
    }
  }, [appOnline]);
}

/**
 * Clears both the in-memory QueryClient cache and the persisted MMKV cache.
 * Call this on sign-out so user/household data does not leak across accounts.
 */
export function clearAllQueryCaches() {
  log.info("Clearing all query caches (in-memory + persisted)");
  persistedQueryClient.clear();
  queryCacheStorage.clearAll();
}

/**
 * Clears both the in-memory QueryClient cache and the persisted MMKV cache.
 * Call this when the backend base URL changes so cached data from one
 * environment does not leak into another.
 */
export const clearQueryCachesOnUrlChange = clearAllQueryCaches;
