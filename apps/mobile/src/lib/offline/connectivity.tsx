import React from "react";
import { subscribeDeviceHints } from "@/lib/offline/device-hints";
import { offlineEngine } from "@/lib/offline/engine";
import { useConnectionStatus } from "@/lib/trpc/trpc-provider";

import { ConnectivityProvider as SharedConnectivityProvider } from "@norish/shared-react/offline/react";

export { useConnectivity } from "@norish/shared-react/offline/react";

const probe = () => offlineEngine.probe();

/** Live or Offline by the readiness probe; the device network and the socket only hint. */
export function ConnectivityProvider({ children }: { children: React.ReactNode }) {
  const { status: wsStatus } = useConnectionStatus();

  return (
    <SharedConnectivityProvider
      probe={probe}
      subscribeHints={subscribeDeviceHints}
      wsStatus={wsStatus}
    >
      {children}
    </SharedConnectivityProvider>
  );
}
