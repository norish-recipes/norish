import React, { useMemo } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { useConnectivity } from "@/lib/offline/connectivity";
import { offlineEngine } from "@/lib/offline/engine";
import { useConnectionStatus, useTRPC, useTRPCClient } from "@/lib/trpc/trpc-provider";
import { useQueryClient } from "@tanstack/react-query";

import { sessionVerdict } from "@norish/shared-react/offline";
import { RecoveryProvider, useOfflineController } from "@norish/shared-react/offline/react";

/** Runs the shared offline controller over the app's engine, below auth and tRPC. */
export function OfflineController({ children }: { children: React.ReactNode }) {
  const { user, authClient } = useAuth();
  const { isLive, isOffline, probeNow, subscribeLiveProbes } = useConnectivity();
  const { status: wsStatus } = useConnectionStatus();
  const trpc = useTRPC();
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();

  const recovery = useMemo(() => {
    const warmSet = offlineEngine.createWarmSet(trpc);

    return offlineEngine.createRecovery({
      transport: trpcClient,
      verifySession: async (ownerId) => {
        const session = await authClient?.getSession().catch(() => null);

        return sessionVerdict(session?.data?.user?.id ?? null, ownerId);
      },
      refetchActiveQueries: () => queryClient.refetchQueries({ type: "active" }),
      topUp: warmSet.topUp,
    });
  }, [authClient, queryClient, trpc, trpcClient]);

  const { switching } = useOfflineController({
    cache: offlineEngine.cache,
    outbox: offlineEngine.outbox,
    recovery,
    sessionUserId: user?.id ?? null,
    isLive,
    isOffline,
    probeNow,
    subscribeLiveProbes,
    wsStatus,
  });

  if (switching) {
    return null;
  }

  return <RecoveryProvider recovery={recovery}>{children}</RecoveryProvider>;
}
