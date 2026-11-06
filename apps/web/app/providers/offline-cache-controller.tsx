"use client";

import type { ReactNode } from "react";
import { useConnectivity } from "@/app/providers/connectivity-provider";
import { useConnectionStatus, useTRPC, useTRPCClient } from "@/app/providers/trpc-provider";
import { useUserContext } from "@/context/user-context";
import { offlineEngine } from "@/lib/offline/engine";

import { OfflineController } from "@norish/shared-react/offline/react";
import { getSession } from "@norish/shared/lib/auth/client";

const getSessionUserId = () => getSession().then((session) => session?.data?.user?.id ?? null);

/** The shared offline controller over the web engine, below `UserProvider` and the providers. */
export function OfflineCacheController({
  children,
  seededUserId,
}: {
  children: ReactNode;
  /** The reader the layout's server pass verified; absent offline. */
  seededUserId?: string;
}) {
  const { user } = useUserContext();
  const connectivity = useConnectivity();
  const { status: wsStatus } = useConnectionStatus();
  const trpc = useTRPC();
  const trpcClient = useTRPCClient();

  // The server's verified id stands in until the browser's own session request
  // answers, so the cache restores at hydration rather than a round trip later.
  return (
    <OfflineController
      connectivity={connectivity}
      engine={offlineEngine}
      getSessionUserId={getSessionUserId}
      sessionUserId={user?.id ?? seededUserId ?? null}
      transport={trpcClient}
      trpc={trpc}
      wsStatus={wsStatus}
    >
      {children}
    </OfflineController>
  );
}
