"use client";

import type { OutboxMutationClient } from "@/lib/outbox";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useConnectivity } from "@/app/providers/connectivity-provider";
import { useTRPC, useTRPCClient } from "@/app/providers/trpc-provider";
import { useUserContext } from "@/context/user-context";
import {
  processQueue,
  replayOutboxEntry,
  runReconnectSequence,
  setReplayOwnerResolver,
  setReplaySubmit,
} from "@/lib/outbox";
import { activeCacheOwner, resolveCacheOwner, topUpWarmSet } from "@/lib/query-cache";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Drives the persisted Offline Cache and the Outbox from the two runtime signals
 * they depend on: the authenticated user id (per-user scoping, ADR-0005) and
 * connectivity. It sits below `UserProvider`, `ConnectivityProvider` and
 * `TRPCProviderWrapper` so it can read all three, and renders children unchanged.
 *
 * Responsibilities:
 *  - reconcile the cache owner (restore / switch / purge reads) on identity
 *    change; a departed user's queued mutations are retained dormant under
 *    their owner and can only Replay once that owner signs in again — the
 *    owner-scoped resolver below is what enforces it (ADR-0009);
 *  - register how the Outbox replays (the live tRPC client) and who owns it;
 *  - run the Reconnect Sequence (drain → refetch → warm) when Live returns, and
 *    an initial drain + warm on first load.
 */
export function OfflineCacheController({ children }: { children: ReactNode }) {
  const { user } = useUserContext();
  const { isLive, isOffline } = useConnectivity();
  const trpc = useTRPC();
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();

  const sessionUserId = user?.id ?? null;
  const [readyOwner, setReadyOwner] = useState<string | null>(null);

  // Reconcile the persisted cache with the current identity (restore/switch/purge).
  useEffect(() => {
    let cancelled = false;

    void resolveCacheOwner({ sessionUserId, isOffline }).then(() => {
      if (!cancelled) {
        setReadyOwner(activeCacheOwner());
      }
    });

    return () => {
      cancelled = true;
    };
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
    setReplayOwnerResolver(() => activeCacheOwner());

    return () => {
      setReplaySubmit(null);
      setReplayOwnerResolver(null);
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

    if (!isLive || !readyOwner) {
      return;
    }

    const reconnecting = wasOffline.current;

    wasOffline.current = false;

    if (!reconnecting && startedForOwner.current === readyOwner) {
      return;
    }

    startedForOwner.current = readyOwner;

    void runReconnectSequence({
      // Drain is leader-gated + FIFO-ordered inside processQueue; a non-leader
      // tab blocks until the leader's drain completes, so refetch never races
      // ahead of it. Invalidate is per-tab (each refetches its own view). Warm
      // is leader-gated inside topUpWarmSet, which also stamps last-warmed:
      // other tabs pick both up from the shared persisted cache rather than
      // re-fetching the whole Warm Set concurrently (ADR).
      drain: () => processQueue(),
      invalidate: () => (reconnecting ? queryClient.invalidateQueries() : Promise.resolve()),
      warm: () => topUpWarmSet({ trpc, queryClient }),
    });
  }, [isLive, isOffline, readyOwner, queryClient, trpc]);

  return <>{children}</>;
}
