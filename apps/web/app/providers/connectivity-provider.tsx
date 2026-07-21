"use client";

import type { ConnectivitySnapshot, ConnectivityState } from "@/lib/connectivity";
import type { ReactNode } from "react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useConnectionStatus } from "@/app/providers/trpc-provider";
import {
  INITIAL_CONNECTIVITY,
  isOfflineForced,
  nextProbeDelayMs,
  probeBackendReachable,
  reduceProbeResult,
  subscribeOfflineForced,
} from "@/lib/connectivity";

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
}

const ConnectivityContext = createContext<ConnectivityValue>({
  state: "live",
  posture: "live",
  isLive: true,
  isOffline: false,
  isForced: false,
});

export function useConnectivity(): ConnectivityValue {
  return useContext(ConnectivityContext);
}

const serverForcedSnapshot = () => false;

/**
 * Owns the Live/Offline runtime: a self-scheduling health-probe loop whose
 * cadence comes from the pure state machine (slow heartbeat while Live,
 * exponential backoff while Offline). WebSocket status and `navigator.onLine`
 * are treated as *hints* — they only nudge the loop to probe sooner; the probe
 * itself is the sole verdict.
 */
export function ConnectivityProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<ConnectivitySnapshot>(INITIAL_CONNECTIVITY);
  const { status: wsStatus } = useConnectionStatus();

  // The dev-only forced-Offline override (ADR-0007). Always false in production,
  // where subscribeOfflineForced is a no-op and isOfflineForced folds to false.
  const forced = useSyncExternalStore(
    subscribeOfflineForced,
    isOfflineForced,
    serverForcedSnapshot
  );

  const snapshotRef = useRef<ConnectivitySnapshot>(snapshot);

  snapshotRef.current = snapshot;

  // Imperative handle to force an out-of-band probe; swapped for a no-op on unmount.
  const probeNowRef = useRef<() => void>(() => {});

  useEffect(() => {
    // Radio silence while Offline is forced: no probes are scheduled and
    // probeNowRef stays a no-op, so the WS/onLine hints below can't wake one
    // either (ADR-0007). Clearing the override re-runs this effect and the
    // normal loop resumes — the organic reconnect path.
    if (forced) {
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let inFlight = false;
    let rerunRequested = false;

    const runProbe = async () => {
      if (cancelled || inFlight) {
        // A probe already running: remember the request and coalesce it.
        if (inFlight) {
          rerunRequested = true;
        }

        return;
      }

      inFlight = true;

      const reachable = await probeBackendReachable();

      inFlight = false;

      if (cancelled) {
        return;
      }

      const next = reduceProbeResult(snapshotRef.current, reachable);

      snapshotRef.current = next;
      setSnapshot(next);

      if (rerunRequested) {
        rerunRequested = false;
        void runProbe();

        return;
      }

      timer = setTimeout(() => void runProbe(), nextProbeDelayMs(next));
    };

    const probeNow = () => {
      if (cancelled) {
        return;
      }

      if (timer) {
        clearTimeout(timer);
        timer = null;
      }

      void runProbe();
    };

    probeNowRef.current = probeNow;

    // Probe once immediately so the first verdict is established quickly.
    void runProbe();

    // Browser connectivity is only a hint — never the verdict — so an online/offline
    // event just accelerates the next probe rather than deciding the state itself.
    window.addEventListener("online", probeNow);
    window.addEventListener("offline", probeNow);

    return () => {
      cancelled = true;

      if (timer) {
        clearTimeout(timer);
      }

      probeNowRef.current = () => {};
      window.removeEventListener("online", probeNow);
      window.removeEventListener("offline", probeNow);
    };
  }, [forced]);

  // WebSocket transitions are hints too: a drop or a (re)connect means the
  // backend's reachability likely just changed, so re-probe without waiting.
  const previousWsStatusRef = useRef(wsStatus);

  useEffect(() => {
    if (previousWsStatusRef.current === wsStatus) {
      return;
    }

    previousWsStatusRef.current = wsStatus;

    if (wsStatus === "disconnected" || wsStatus === "connected") {
      probeNowRef.current();
    }
  }, [wsStatus]);

  const value = useMemo<ConnectivityValue>(() => {
    const posture: ConnectivityPosture = forced ? "offline-forced" : snapshot.state;

    return {
      state: snapshot.state,
      posture,
      isLive: posture === "live",
      isOffline: posture !== "live",
      isForced: posture === "offline-forced",
    };
  }, [snapshot.state, forced]);

  return <ConnectivityContext.Provider value={value}>{children}</ConnectivityContext.Provider>;
}
