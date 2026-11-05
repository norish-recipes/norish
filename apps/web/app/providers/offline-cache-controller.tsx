"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import { useConnectivity } from "@/app/providers/connectivity-provider";
import { useConnectionStatus, useTRPCClient } from "@/app/providers/trpc-provider";
import { useUserContext } from "@/context/user-context";
import { useWarmSet } from "@/hooks/use-warm-set";
import { cacheManager, offlineEngine, outboxStore } from "@/lib/offline/engine";
import { useQueryClient } from "@tanstack/react-query";

import { sessionVerdict } from "@norish/shared-react/offline";
import { RecoveryProvider, useOfflineController } from "@norish/shared-react/offline/react";
import { getSession } from "@norish/shared/lib/auth/client";

/**
 * Runs the shared offline controller (owner scoping, Recovery triggers, ADR-0009) over the
 * web engine. It sits below `UserProvider`, `ConnectivityProvider` and `TRPCProviderWrapper`.
 */
export function OfflineCacheController({
  children,
  seededUserId,
}: {
  children: ReactNode;
  /** The reader the layout's server pass verified; absent offline. */
  seededUserId?: string;
}) {
  const { user } = useUserContext();
  const { isLive, isOffline, probeNow, subscribeLiveProbes } = useConnectivity();
  const { status: wsStatus } = useConnectionStatus();
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();
  const warmSet = useWarmSet();

  const recovery = useMemo(
    () =>
      offlineEngine.createRecovery({
        transport: trpcClient,
        verifySession: async (ownerId) => {
          const session = await getSession().catch(() => null);

          return sessionVerdict(session?.data?.user?.id ?? null, ownerId);
        },
        refetchActiveQueries: () => queryClient.refetchQueries({ type: "active" }),
        topUp: warmSet.topUp,
      }),
    [queryClient, trpcClient, warmSet]
  );

  // The server's verified id stands in until the browser's own session request
  // answers, so the cache restores at hydration rather than a round trip later.
  const { switching } = useOfflineController({
    cache: cacheManager,
    outbox: outboxStore,
    recovery,
    sessionUserId: user?.id ?? seededUserId ?? null,
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
