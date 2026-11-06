"use client";

import type { TRPCOptionsProxy } from "@trpc/tanstack-react-query";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { AppRouter } from "@norish/trpc/client";

import type { ConnectionStatus } from "../../providers/trpc-provider";
import type { OfflineEngine } from "../engine";
import type { OutboxMutationClient } from "../replay-client";
import type { ConnectivityValue } from "./connectivity";
import { sessionVerdict } from "../recovery";
import { RecoveryProvider } from "./recovery-context";
import { useOfflineController } from "./use-offline-controller";
import { useWarmSet } from "./use-warm-set";

/** Runs the offline controller over a client's engine and provides its Recovery. */
export function OfflineController({
  children,
  engine,
  transport,
  trpc,
  getSessionUserId,
  sessionUserId,
  connectivity: { isLive, isOffline, probeNow, subscribeLiveProbes },
  wsStatus,
}: {
  children: ReactNode;
  engine: Pick<OfflineEngine, "cache" | "outbox" | "createRecovery" | "createWarmSet">;
  transport: OutboxMutationClient;
  trpc: TRPCOptionsProxy<AppRouter>;
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
  const warmSet = useWarmSet(engine, trpc);

  const recovery = useMemo(
    () =>
      engine.createRecovery({
        transport,
        verifySession: async (ownerId) =>
          sessionVerdict(await getSessionUserId().catch(() => null), ownerId),
        refetchActiveQueries: () => queryClient.refetchQueries({ type: "active" }),
        topUp: warmSet.topUp,
      }),
    [engine, getSessionUserId, queryClient, transport, warmSet]
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
