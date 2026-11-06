import React, { useCallback } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { useConnectivity } from "@/lib/offline/connectivity";
import { offlineEngine } from "@/lib/offline/engine";
import { useConnectionStatus, useTRPC, useTRPCClient } from "@/lib/trpc/trpc-provider";

import { OfflineController as SharedOfflineController } from "@norish/shared-react/offline/react";

/** The shared offline controller over the app's engine, below auth and tRPC. */
export function OfflineController({ children }: { children: React.ReactNode }) {
  const { user, authClient } = useAuth();
  const connectivity = useConnectivity();
  const { status: wsStatus } = useConnectionStatus();
  const trpc = useTRPC();
  const trpcClient = useTRPCClient();
  const getSessionUserId = useCallback(
    async () => (await authClient?.getSession())?.data?.user?.id ?? null,
    [authClient]
  );

  return (
    <SharedOfflineController
      connectivity={connectivity}
      engine={offlineEngine}
      getSessionUserId={getSessionUserId}
      sessionUserId={user?.id ?? null}
      transport={trpcClient}
      trpc={trpc}
      wsStatus={wsStatus}
    >
      {children}
    </SharedOfflineController>
  );
}
