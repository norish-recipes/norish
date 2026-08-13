"use client";

import type { OutboxMutationClient } from "@/lib/outbox";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useConnectivity } from "@/app/providers/connectivity-provider";
import { RecoveryProvider } from "@/app/providers/recovery-provider";
import { useConnectionStatus, useTRPCClient } from "@/app/providers/trpc-provider";
import { useUserContext } from "@/context/user-context";
import { useWarmSet } from "@/hooks/use-warm-set";
import { outboxStore, replayOutboxEntry } from "@/lib/outbox";
import { createRecovery } from "@/lib/outbox/recovery";
import { cacheManager } from "@/lib/query-cache";
import { useQueryClient } from "@tanstack/react-query";

import { getSession } from "@norish/shared/lib/auth/client";

/**
 * Drives the persisted Offline Cache and the Outbox from the two runtime signals
 * they depend on: the authenticated user id (per-user scoping, ADR-0005) and
 * connectivity. It sits below `UserProvider`, `ConnectivityProvider` and
 * `TRPCProviderWrapper` so it can read all three, and renders children unchanged.
 *
 * Responsibilities:
 *  - reconcile the cache owner (restore / switch / purge reads) on identity
 *    change; children stay hidden while an authenticated owner switch is
 *    resolved, and a departed user's queued mutations are retained dormant under
 *    their owner and can only Replay once that owner signs in again — the
 *    owner-scoped resolver below is what enforces it (ADR-0009);
 *  - construct Recovery from the live tRPC client, Outbox, active-query refetch,
 *    and Warm Set;
 *  - trigger it on startup, Offline→Live and WebSocket reconnection.
 */
export function OfflineCacheController({ children }: { children: ReactNode }) {
  const { user } = useUserContext();
  const { isLive, isOffline } = useConnectivity();
  const { status: wsStatus } = useConnectionStatus();
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();
  const warmSet = useWarmSet();

  const sessionUserId = user?.id ?? null;
  const owner = useSyncExternalStore(cacheManager.subscribe, cacheManager.owner, () => null);
  const recovery = useMemo(
    () =>
      createRecovery({
        store: outboxStore,
        owner: cacheManager.owner,
        submit: (entry) => replayOutboxEntry(trpcClient as OutboxMutationClient, entry),
        verifySession: async (ownerId) => {
          try {
            const session = await getSession();
            const liveUserId = session?.data?.user?.id ?? null;

            if (liveUserId === null) return "unverifiable";

            return liveUserId === ownerId ? "match" : "mismatch";
          } catch {
            return "unverifiable";
          }
        },
        refetchActiveQueries: () => queryClient.refetchQueries({ type: "active" }),
        topUp: warmSet.topUp,
      }),
    [queryClient, trpcClient, warmSet]
  );

  // Reconcile the persisted cache with the current identity (restore/switch/purge).
  useEffect(() => {
    void cacheManager.reconcileIdentity({ sessionUserId, isOffline });
  }, [sessionUserId, isOffline]);

  // A bypassed identity transition retains other owners' queued mutations
  // dormant (ADR-0009 supersedes ADR-0005's unconditional purge): nothing is
  // purged here, and the owner-scoped Replay resolver below guarantees a
  // dormant entry never replays under the incoming account. Explicit sign-out
  // discards the active queue via its own confirmed path instead.

  // Recovery runs for startup, Offline→Live and WebSocket reconnection. Calls
  // coalesce with manual sync and retry continuation inside the same instance.
  const wasOffline = useRef(false);
  const startedForOwner = useRef<string | null>(null);
  const previousWsStatus = useRef(wsStatus);
  const hasEverConnected = useRef(false);

  useEffect(() => {
    const socketConnected = previousWsStatus.current !== "connected" && wsStatus === "connected";
    // Only a *re*connection can have missed anything. The first connect of a
    // page load happens alongside the page's own first fetches, which already
    // read the live server.
    const socketReconnected = socketConnected && hasEverConnected.current;

    previousWsStatus.current = wsStatus;

    if (wsStatus === "connected") {
      hasEverConnected.current = true;
    }

    if (isOffline) {
      wasOffline.current = true;

      return;
    }

    if (!isLive || !owner) {
      return;
    }

    const returningLive = wasOffline.current;
    const starting = startedForOwner.current !== owner;

    wasOffline.current = false;

    if (!starting && !returningLive && !socketReconnected) {
      return;
    }

    startedForOwner.current = owner;
    // Startup follows the page's own fetches, so recovery does not refresh the
    // reads again unless Replay actually sent something. Coming back online or
    // reconnecting always refreshes — those genuinely may have missed changes.
    void recovery.recover(returningLive || socketReconnected ? "resync" : "startup");
  }, [isLive, isOffline, owner, recovery, wsStatus]);

  // CacheManager clears the outgoing QueryClient before activating the
  // incoming owner, but that work crosses an async boundary. Do not let the
  // incoming account render against the previous owner's still-live cache in
  // the render between the session change and reconciliation completing.
  if (sessionUserId !== null && owner !== sessionUserId) {
    return null;
  }

  return <RecoveryProvider recovery={recovery}>{children}</RecoveryProvider>;
}
