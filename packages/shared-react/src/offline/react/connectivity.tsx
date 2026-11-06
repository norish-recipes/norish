"use client";

import type { ReactNode } from "react";
import { createContext, use, useMemo } from "react";

import type { ConnectionStatus } from "../../providers/trpc-provider";
import type { ConnectivityState } from "../connectivity-machine";
import type { ConnectivityLoopValue } from "./use-connectivity-loop";
import { useConnectivityLoop } from "./use-connectivity-loop";

/** The machine state plus web's dev-only forced Offline (ADR-0007), which production never has. */
export type ConnectivityPosture = ConnectivityState | "offline-forced";

export interface ConnectivityValue extends ConnectivityLoopValue {
  posture: ConnectivityPosture;
  isLive: boolean;
  /** Offline for any reason: a failed probe or the forced override. */
  isOffline: boolean;
  isForced: boolean;
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

/** Live or Offline by the probe loop; `forced` pauses the loop, so no hint can wake a probe. */
export function ConnectivityProvider({
  children,
  probe,
  forced = false,
  wsStatus,
  subscribeHints,
}: {
  children: ReactNode;
  probe: () => Promise<boolean>;
  forced?: boolean;
  wsStatus: ConnectionStatus;
  subscribeHints: (probeNow: () => void) => () => void;
}) {
  const { state, probeNow, subscribeLiveProbes } = useConnectivityLoop({
    probe,
    paused: forced,
    wsStatus,
    subscribeHints,
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
