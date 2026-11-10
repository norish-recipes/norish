"use client";

import type { ReactNode } from "react";
import { offlineEngine } from "@/lib/offline/engine";

import { OfflineController, useConnectivity } from "@norish/shared-react/offline/react";
import { useReader } from "@norish/shared-react/reader";
import { useConnectionStatus, useTRPC, useTRPCClient } from "@norish/shared-react/trpc";
import { getSession } from "@norish/shared/lib/auth/client";

const getSessionUserId = () => getSession().then((session) => session?.data?.user?.id ?? null);

/** The shared offline controller over the web engine, which reads the Reader. */
export function OfflineCacheController({
  children,
  seededUserId,
}: {
  children: ReactNode;
  /** The reader the layout's server pass verified; absent offline. */
  seededUserId?: string;
}) {
  const { user } = useReader();
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
