import { useEffect } from "react";
import { AppState } from "react-native";
import { getBackendHealthUrl } from "@/lib/network/backend-base-url";

const BACKEND_HEALTH_TIMEOUT_MS = 5_000;
const BACKEND_HEALTH_POLL_INTERVAL_MS = 30_000;

/**
 * Probes backend reachability via HTTP health checks when no active session
 * exists (i.e. no WebSocket connection to signal reachability). Fires on
 * mount, on app foregrounding, and on a 30s polling interval.
 *
 * Skipped when there is no backend URL, the device is offline, or an active
 * session already has a WebSocket providing reachability signals.
 */
export function useBackendHealthProbe({
  backendBaseUrl,
  deviceOnline,
  hasActiveSession,
  onReachable,
  onUnreachable,
}: {
  backendBaseUrl: string | null;
  deviceOnline: boolean;
  hasActiveSession: boolean;
  onReachable: () => void;
  onUnreachable: () => void;
}): void {
  useEffect(() => {
    if (!backendBaseUrl || !deviceOnline || hasActiveSession) {
      return;
    }

    const healthUrl = getBackendHealthUrl(backendBaseUrl);
    let cancelled = false;

    async function probeBackend() {
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort();
      }, BACKEND_HEALTH_TIMEOUT_MS);

      try {
        const response = await fetch(healthUrl, {
          method: "GET",
          signal: controller.signal,
        });

        if (!cancelled) {
          if (response.ok) {
            onReachable();
          } else {
            onUnreachable();
          }
        }
      } catch {
        if (!cancelled) {
          onUnreachable();
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    void probeBackend();

    const appStateSub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void probeBackend();
      }
    });

    const poll = setInterval(() => {
      void probeBackend();
    }, BACKEND_HEALTH_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      appStateSub.remove();
      clearInterval(poll);
    };
  }, [backendBaseUrl, deviceOnline, hasActiveSession, onReachable, onUnreachable]);
}
