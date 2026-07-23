"use client";

import type { OutboxMutationClient } from "@/lib/outbox";
import type { ReactNode } from "react";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { useConnectivity } from "@/app/providers/connectivity-provider";
import { useTRPCClient } from "@/app/providers/trpc-provider";
import { useUserContext } from "@/context/user-context";
import { useWarmSet } from "@/hooks/use-warm-set";
import {
  processQueue,
  replayOutboxEntry,
  runReconnectSequence,
  setReplayOwnerResolver,
  setReplaySessionGuard,
  setReplaySubmit,
} from "@/lib/outbox";
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
 *  - register how the Outbox replays (the live tRPC client) and who owns it;
 *  - run the Reconnect Sequence (drain → refetch → warm) when Live returns, and
 *    an initial drain + warm on first load.
 */
export function OfflineCacheController({ children }: { children: ReactNode }) {
  const { user } = useUserContext();
  const { isLive, isOffline } = useConnectivity();
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();
  const warmSet = useWarmSet();

  const sessionUserId = user?.id ?? null;
  const owner = useSyncExternalStore(cacheManager.subscribe, cacheManager.owner, () => null);

  // Reconcile the persisted cache with the current identity (restore/switch/purge).
  useEffect(() => {
    void cacheManager.reconcileIdentity({ sessionUserId, isOffline });
  }, [sessionUserId, isOffline]);

  // A bypassed identity transition retains other owners' queued mutations
  // dormant (ADR-0009 supersedes ADR-0005's unconditional purge): nothing is
  // purged here, and the owner-scoped Replay resolver below guarantees a
  // dormant entry never replays under the incoming account. Explicit sign-out
  // discards the active queue via its own confirmed path instead.

  // Teach the Replay engine how to resubmit an entry (through the live client)
  // and who the current owner is.
  useEffect(() => {
    if (!trpcClient) {
      return;
    }

    setReplaySubmit((entry) => replayOutboxEntry(trpcClient as OutboxMutationClient, entry));
    setReplayOwnerResolver(cacheManager.owner);
    // Verify the live session right before a drain: a bypassed identity
    // change can swap the transport cookies under a tab whose local owner
    // state is stale, and the queue must never replay as the incoming
    // account (ADR-0009). Unreachable auth means the pass simply halts on
    // transport as usual.
    setReplaySessionGuard(async (ownerId) => {
      try {
        const session = await getSession();
        const sessionUserId = session?.data?.user?.id ?? null;

        if (sessionUserId === null) return "unverifiable";

        return sessionUserId === ownerId ? "match" : "mismatch";
      } catch {
        return "unverifiable";
      }
    });

    return () => {
      setReplaySubmit(null);
      setReplayOwnerResolver(null);
      setReplaySessionGuard(null);
    };
  }, [trpcClient]);

  // Reconnect Sequence. On the first Live render for an owner: drain any leftover
  // Outbox entries, then warm. On an Offline→Live reconnect: drain, then refetch
  // server truth, then warm — strictly in that order.
  const wasOffline = useRef(false);
  const startedForOwner = useRef<string | null>(null);

  useEffect(() => {
    if (isOffline) {
      wasOffline.current = true;

      return;
    }

    if (!isLive || !owner) {
      return;
    }

    const reconnecting = wasOffline.current;

    wasOffline.current = false;

    if (!reconnecting && startedForOwner.current === owner) {
      return;
    }

    startedForOwner.current = owner;

    void runReconnectSequence({
      // Drain is leader-gated + FIFO-ordered inside processQueue; a non-leader
      // tab blocks until the leader's drain completes, so refetch never races
      // ahead of it. Invalidate is per-tab (each refetches its own view). Warm
      // is leader-gated inside WarmSet, which also stamps last-warmed:
      // other tabs pick both up from the shared persisted cache rather than
      // re-fetching the whole Warm Set concurrently (ADR).
      drain: () => processQueue(),
      invalidate: () => (reconnecting ? queryClient.invalidateQueries() : Promise.resolve()),
      warm: () => warmSet.topUp(),
    });
  }, [isLive, isOffline, owner, queryClient, warmSet]);

  // CacheManager clears the outgoing QueryClient before activating the
  // incoming owner, but that work crosses an async boundary. Do not let the
  // incoming account render against the previous owner's still-live cache in
  // the render between the session change and reconciliation completing.
  if (sessionUserId !== null && owner !== sessionUserId) {
    return null;
  }

  return <>{children}</>;
}
