"use client";

import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";
import { useConnectionStatus } from "@/app/providers/trpc-provider";
import { isOfflineForced, probeBackendReachable, subscribeOfflineForced } from "@/lib/connectivity";

import { ConnectivityProvider as SharedConnectivityProvider } from "@norish/shared-react/offline/react";

export {
  type ConnectivityPosture,
  type ConnectivityValue,
  useConnectivity,
} from "@norish/shared-react/offline/react";

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

/** The shared probe loop with `navigator.onLine` as a hint, plus the dev forced Offline (ADR-0007). */
export function ConnectivityProvider({ children }: { children: ReactNode }) {
  const { status: wsStatus } = useConnectionStatus();

  // Always false in production, where subscribeOfflineForced is a no-op.
  const forced = useSyncExternalStore(
    subscribeOfflineForced,
    isOfflineForced,
    serverForcedSnapshot
  );

  return (
    <SharedConnectivityProvider
      forced={forced}
      probe={probeBackendReachable}
      subscribeHints={subscribeBrowserHints}
      wsStatus={wsStatus}
    >
      {children}
    </SharedConnectivityProvider>
  );
}
