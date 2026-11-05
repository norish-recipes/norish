import React, { createContext, use, useMemo } from "react";
import { subscribeDeviceHints } from "@/lib/offline/device-hints";
import { offlineEngine } from "@/lib/offline/engine";
import { useConnectionStatus } from "@/lib/trpc/trpc-provider";

import type { ConnectivityLoopValue } from "@norish/shared-react/offline/react";
import { useConnectivityLoop } from "@norish/shared-react/offline/react";

export interface ConnectivityValue extends ConnectivityLoopValue {
  isLive: boolean;
  isOffline: boolean;
}

const ConnectivityContext = createContext<ConnectivityValue>({
  state: "live",
  isLive: true,
  isOffline: false,
  probeNow: () => {},
  subscribeLiveProbes: () => () => {},
});

export function useConnectivity(): ConnectivityValue {
  return use(ConnectivityContext);
}

const probe = () => offlineEngine.probe();

/** Live or Offline by the readiness probe; the device network and the socket only hint. */
export function ConnectivityProvider({ children }: { children: React.ReactNode }) {
  const { status: wsStatus } = useConnectionStatus();
  const { state, probeNow, subscribeLiveProbes } = useConnectivityLoop({
    probe,
    wsStatus,
    subscribeHints: subscribeDeviceHints,
  });

  const value = useMemo<ConnectivityValue>(
    () => ({
      state,
      isLive: state === "live",
      isOffline: state === "offline",
      probeNow,
      subscribeLiveProbes,
    }),
    [state, probeNow, subscribeLiveProbes]
  );

  return <ConnectivityContext value={value}>{children}</ConnectivityContext>;
}
