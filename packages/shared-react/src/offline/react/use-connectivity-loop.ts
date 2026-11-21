"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ConnectionStatus } from "../../trpc/trpc-provider";
import type { ConnectivitySnapshot, ConnectivityState } from "../connectivity-machine";
import { startConnectivityLoop } from "../connectivity-loop";
import { INITIAL_CONNECTIVITY } from "../connectivity-machine";

export interface ConnectivityLoopValue {
  state: ConnectivityState;
  /** Probe now instead of at the next tick. A hint: the probe stays the sole verdict. */
  probeNow: () => void;
  /** Hear every reachable verdict, the Live heartbeat included; queued work drains on these. */
  subscribeLiveProbes: (listener: () => void) => () => void;
}

/**
 * Runs the Live/Offline probe loop for a client. The device's own network signal and
 * WebSocket transitions are hints: they only bring the next probe forward.
 */
export function useConnectivityLoop({
  probe,
  paused = false,
  wsStatus,
  subscribeHints,
}: {
  probe: () => Promise<boolean>;
  /** No probes at all while set (web's forced Offline); clearing it resumes the loop. */
  paused?: boolean;
  wsStatus: ConnectionStatus;
  /** The platform's network signal; calls `probeNow` on a change. Must be stable. */
  subscribeHints: (probeNow: () => void) => () => void;
}): ConnectivityLoopValue {
  const [snapshot, setSnapshot] = useState<ConnectivitySnapshot>(INITIAL_CONNECTIVITY);
  // The loop below is the only writer of snapshot, and it writes this ref first.
  const snapshotRef = useRef<ConnectivitySnapshot>(snapshot);
  // Swapped for a no-op while paused or unmounted.
  const probeNowRef = useRef<() => void>(() => {});
  // Told about every reachable verdict; survives the loop's own restarts.
  const liveProbeListenersRef = useRef(new Set<() => void>());

  useEffect(() => {
    if (paused) {
      return;
    }

    const loop = startConnectivityLoop({
      probe,
      initial: snapshotRef.current,
      onVerdict: (next, reachable) => {
        snapshotRef.current = next;
        setSnapshot(next);

        if (reachable) {
          for (const listener of liveProbeListenersRef.current) listener();
        }
      },
    });

    probeNowRef.current = loop.probeNow;
    const unsubscribeHints = subscribeHints(loop.probeNow);

    return () => {
      loop.stop();
      probeNowRef.current = () => {};
      unsubscribeHints();
    };
  }, [paused, probe, subscribeHints]);

  // A socket drop or (re)connect means reachability likely just changed.
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

  const probeNow = useCallback(() => probeNowRef.current(), []);
  const subscribeLiveProbes = useCallback((listener: () => void) => {
    const listeners = liveProbeListenersRef.current;

    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }, []);

  return { state: snapshot.state, probeNow, subscribeLiveProbes };
}
