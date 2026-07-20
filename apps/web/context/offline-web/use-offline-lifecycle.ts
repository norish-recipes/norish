import type { OfflineWebPhase } from "@/context/offline-web/shared";
import type { WebConnectivityRuntime, WebConnectivityState } from "@/lib/connectivity";
import type { WebReadCacheScope } from "@/lib/offline-read-cache";
import type { RefObject } from "react";
import { useEffect } from "react";
import { checkWebBackendReachability } from "@/lib/connectivity";
import { subscribeToWebReadCacheChanges } from "@/lib/offline-read-cache";

type UseOfflineStartupLifecycleOptions = {
  commitPhase: (phase: OfflineWebPhase) => void;
  connectivityRuntime: WebConnectivityRuntime;
  connectivityState: WebConnectivityState;
  connectivityTransportFailureConfirmed: boolean;
  fallbackDeadlineMs: number;
  phase: OfflineWebPhase;
  phaseRef: RefObject<OfflineWebPhase>;
  prepareScope: () => void;
  restoredQueryCount: number;
  restoreFallback: () => Promise<void>;
};

export function useOfflineStartupLifecycle({
  commitPhase,
  connectivityRuntime,
  connectivityState,
  connectivityTransportFailureConfirmed,
  fallbackDeadlineMs,
  phase,
  phaseRef,
  prepareScope,
  restoredQueryCount,
  restoreFallback,
}: UseOfflineStartupLifecycleOptions) {
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
    prepareScope();

    return connectivityRuntime.start(checkWebBackendReachability);
  }, [connectivityRuntime, prepareScope]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (phaseRef.current === "probing-live") void restoreFallback();
    }, fallbackDeadlineMs);

    return () => window.clearTimeout(timeout);
  }, [fallbackDeadlineMs, phaseRef, restoreFallback]);

  useEffect(() => {
    if (connectivityState === "online") {
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

    if (connectivityState === "offline" || connectivityState === "backend-unreachable") {
      if (phaseRef.current === "probing-live" && !connectivityTransportFailureConfirmed) {
        return;
      }

      if (
        phaseRef.current === "probing-live" ||
        phaseRef.current === "live" ||
        phaseRef.current === "recovering"
      ) {
        void restoreFallback();
      }
    }
  }, [
    commitPhase,
    connectivityState,
    connectivityTransportFailureConfirmed,
    phaseRef,
    restoreFallback,
  ]);

  useEffect(() => {
    if (connectivityState === "online" && phase === "recovering" && restoredQueryCount === 0) {
      commitPhase("live");
    }
  }, [commitPhase, connectivityState, phase, restoredQueryCount]);
}

type UseOfflineRecoveryLifecycleOptions = {
  commitPhase: (phase: OfflineWebPhase) => void;
  connectivityRuntime: WebConnectivityRuntime;
  pruneInactiveRestoredQueries: () => void;
  refreshInventory: (scope?: WebReadCacheScope | null) => Promise<void>;
  restoredQueryIdentitiesRef: RefObject<Set<string>>;
  restoreFallback: () => Promise<void>;
};

export function useOfflineRecoveryLifecycle({
  commitPhase,
  connectivityRuntime,
  pruneInactiveRestoredQueries,
  refreshInventory,
  restoredQueryIdentitiesRef,
  restoreFallback,
}: UseOfflineRecoveryLifecycleOptions) {
  useEffect(() => {
    const unsubscribe = subscribeToWebReadCacheChanges(() => void refreshInventory());
    const settled = () => {
      void (async () => {
        if (connectivityRuntime.isDegraded()) {
          await restoreFallback();

          return;
        }

        commitPhase("recovering");
        pruneInactiveRestoredQueries();
        if (restoredQueryIdentitiesRef.current.size === 0) commitPhase("live");
      })();
    };

    const unsubscribeReplay = connectivityRuntime.recovery.subscribeToReplaySettled(settled);

    return () => {
      unsubscribe();
      unsubscribeReplay();
    };
  }, [
    commitPhase,
    connectivityRuntime,
    pruneInactiveRestoredQueries,
    refreshInventory,
    restoredQueryIdentitiesRef,
    restoreFallback,
  ]);
}
