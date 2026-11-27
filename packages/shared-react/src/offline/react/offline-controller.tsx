"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { ConnectionStatus } from "../../trpc/trpc-provider";
import type { OfflineEngine } from "../engine";
import type { ConnectivityValue } from "./connectivity";
import { usePlatform } from "../../platform";
import { useTRPC, useTRPCClient } from "../../trpc";
import { householdIdOf } from "../household";
import { sessionVerdict } from "../recovery";
import { RecoveryProvider } from "./recovery-context";
import { useOfflineController } from "./use-offline-controller";
import { useWarmSet } from "./use-warm-set";

/** Runs the offline controller over a client's engine and provides its Recovery. */
export function OfflineController({
  children,
  engine,
  getSessionUserId,
  sessionUserId,
  connectivity: { isLive, isOffline, probeNow, subscribeLiveProbes },
  wsStatus,
}: {
  children: ReactNode;
  engine: Pick<OfflineEngine, "cache" | "outbox" | "createRecovery" | "createWarmSet">;
  /** The live session's user, asked before Replay; must be stable. */
  getSessionUserId: () => Promise<string | null>;
  /** The signed-in user, or null while signed out or still unknown. */
  sessionUserId: string | null;
  connectivity: Pick<
    ConnectivityValue,
    "isLive" | "isOffline" | "probeNow" | "subscribeLiveProbes"
  >;
  wsStatus: ConnectionStatus;
}) {
  const queryClient = useQueryClient();
  const { toast } = usePlatform();
  const trpc = useTRPC();
  const transport = useTRPCClient();
  const warmSet = useWarmSet(engine);

  const recovery = useMemo(
    () =>
      engine.createRecovery({
        transport,
        verifySession: async (ownerId) =>
          sessionVerdict(await getSessionUserId().catch(() => null), ownerId),
        // Through the cache, so an answer naming another household also empties the former's reads.
        currentHousehold: () =>
          queryClient
            .query({ ...trpc.households.get.queryOptions(), staleTime: 0 })
            .then(householdIdOf),
        refetchActiveQueries: () => queryClient.refetchQueries({ type: "active" }),
        topUp: warmSet.topUp,
      }),
    [engine, getSessionUserId, queryClient, transport, trpc, warmSet]
  );

  // Refused as stale: what is on show refetches the server's state, and the user hears it once.
  useEffect(
    () =>
      recovery.subscribeConflicts(() => {
        void queryClient.invalidateQueries();
        toast.show({
          severity: "warning",
          title: toast.translate("common.changedElsewhere.title"),
        });
      }),
    [queryClient, recovery, toast]
  );

  const { switching } = useOfflineController({
    engine,
    recovery,
    sessionUserId,
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
