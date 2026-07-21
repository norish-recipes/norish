"use client";

import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useConnectionStatus } from "@/app/providers/trpc-provider";

import {
  type ConnectivitySnapshot,
  type ConnectivityState,
  INITIAL_CONNECTIVITY,
  nextProbeDelayMs,
  probeBackendReachable,
  reduceProbeResult,
} from "@/lib/connectivity";

export interface ConnectivityValue {
  state: ConnectivityState;
  isLive: boolean;
  isOffline: boolean;
}

const ConnectivityContext = createContext<ConnectivityValue>({
  state: "live",
  isLive: true,
  isOffline: false,
});

export function useConnectivity(): ConnectivityValue {
  return useContext(ConnectivityContext);
}

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

  const snapshotRef = useRef<ConnectivitySnapshot>(snapshot);

  snapshotRef.current = snapshot;

  // Imperative handle to force an out-of-band probe; swapped for a no-op on unmount.
  const probeNowRef = useRef<() => void>(() => {});

  useEffect(() => {
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
  }, []);

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

  const value = useMemo<ConnectivityValue>(
    () => ({
      state: snapshot.state,
      isLive: snapshot.state === "live",
      isOffline: snapshot.state === "offline",
    }),
    [snapshot.state]
  );

  return <ConnectivityContext.Provider value={value}>{children}</ConnectivityContext.Provider>;
}
