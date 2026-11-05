"use client";

import type { ReactNode } from "react";
import { createContext, use, useMemo, useSyncExternalStore } from "react";
import { useConnectionStatus } from "@/app/providers/trpc-provider";
import { isOfflineForced, probeBackendReachable, subscribeOfflineForced } from "@/lib/connectivity";

import type { ConnectivityState } from "@norish/shared-react/offline";
import { useConnectivityLoop } from "@norish/shared-react/offline/react";

/**
 * The effective connectivity posture: the pure machine state plus the dev-only
 * forced-Offline override (ADR-0007). `offline-forced` never exists in
 * production, where the override is always absent and the posture collapses back
 * to the machine `state`.
 */
export type ConnectivityPosture = "live" | "offline" | "offline-forced";

export interface ConnectivityValue {
  /** The pure reachability-machine state (`live | offline`), override aside. */
  state: ConnectivityState;
  /** Effective posture, including the dev forced-Offline override. */
  posture: ConnectivityPosture;
  isLive: boolean;
  /** True while Offline for any reason — a failed probe *or* the dev override. */
  isOffline: boolean;
  /** True only under the dev-only forced-Offline override. */
  isForced: boolean;
  /**
   * Ask the loop to probe now instead of at its next scheduled tick. A hint,
   * like a WebSocket drop: the probe stays the sole verdict.
   */
  probeNow: () => void;
  /**
   * Hear every probe that found the backend reachable — the Live heartbeat
   * included, not only the Offline→Live transition. Queued work that has no
   * transition to wait for drains on these verdicts.
   */
  subscribeLiveProbes: (listener: () => void) => () => void;
}

const ConnectivityContext = createContext<ConnectivityValue>({
  state: "live",
  posture: "live",
  isLive: true,
  isOffline: false,
  isForced: false,
  probeNow: () => {},
  subscribeLiveProbes: () => () => {},
});

export function useConnectivity(): ConnectivityValue {
  return use(ConnectivityContext);
}

const serverForcedSnapshot = () => false;

// Browser connectivity is only a hint, never the verdict: it just brings the next probe forward.
function subscribeBrowserHints(probeNow: () => void): () => void {
  window.addEventListener("online", probeNow);
  window.addEventListener("offline", probeNow);

  return () => {
    window.removeEventListener("online", probeNow);
    window.removeEventListener("offline", probeNow);
  };
}

/**
 * Owns the Live/Offline runtime: the shared probe loop, with WebSocket status and
 * `navigator.onLine` as hints, plus the dev-only forced-Offline override (ADR-0007).
 */
export function ConnectivityProvider({ children }: { children: ReactNode }) {
  const { status: wsStatus } = useConnectionStatus();

  // Always false in production, where subscribeOfflineForced is a no-op.
  const forced = useSyncExternalStore(
    subscribeOfflineForced,
    isOfflineForced,
    serverForcedSnapshot
  );

  // Radio silence while Offline is forced: no probes, and no hint can wake one (ADR-0007).
  const { state, probeNow, subscribeLiveProbes } = useConnectivityLoop({
    probe: probeBackendReachable,
    paused: forced,
    wsStatus,
    subscribeHints: subscribeBrowserHints,
  });

  const value = useMemo<ConnectivityValue>(() => {
    const posture: ConnectivityPosture = forced ? "offline-forced" : state;

    return {
      state,
      posture,
      isLive: posture === "live",
      isOffline: posture !== "live",
      isForced: posture === "offline-forced",
      probeNow,
      subscribeLiveProbes,
    };
  }, [state, forced, probeNow, subscribeLiveProbes]);

  return <ConnectivityContext value={value}>{children}</ConnectivityContext>;
}
