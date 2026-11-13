"use client";

import { useEffect, useRef } from "react";

import type { ConnectionStatus } from "../../providers/trpc-provider";
import type { CacheManager } from "../cache-manager";
import type { OutboxStore } from "../outbox-store";
import type { Recovery } from "../recovery";
import { useCacheOwner } from "./use-cache-owner";

export interface OfflineControllerInputs {
  engine: {
    cache: Pick<CacheManager, "owner" | "subscribe" | "reconcileIdentity">;
    outbox: Pick<OutboxStore, "forOwner" | "subscribe">;
  };
  recovery: Recovery;
  /** The signed-in user, or null while signed out or still unknown. */
  sessionUserId: string | null;
  isLive: boolean;
  isOffline: boolean;
  probeNow: () => void;
  subscribeLiveProbes: (listener: () => void) => () => void;
  wsStatus: ConnectionStatus;
}

// Reconciles the cache owner with the session and runs Recovery on startup, return to Live,
// socket reconnect and queued work. `switching`: an owner switch is resolving, render nothing.
export function useOfflineController({
  engine: { cache, outbox },
  recovery,
  sessionUserId,
  isLive,
  isOffline,
  probeNow,
  subscribeLiveProbes,
  wsStatus,
}: OfflineControllerInputs): { owner: string | null; switching: boolean } {
  const owner = useCacheOwner(cache);

  useEffect(() => {
    void cache.reconcileIdentity({ sessionUserId, isOffline });
  }, [cache, sessionUserId, isOffline]);

  // Recovery runs for startup, Offline→Live and WebSocket reconnection. Calls
  // coalesce with manual sync and retry continuation inside the same instance.
  const wasOfflineRef = useRef(false);
  const startedForOwnerRef = useRef<string | null>(null);
  const previousWsStatusRef = useRef(wsStatus);
  const hasEverConnectedRef = useRef(false);

  useEffect(() => {
    const socketConnected = previousWsStatusRef.current !== "connected" && wsStatus === "connected";
    // Only a *re*connection can have missed anything: the first connect happens alongside
    // the page's own first fetches, which already read the live server.
    const socketReconnected = socketConnected && hasEverConnectedRef.current;

    previousWsStatusRef.current = wsStatus;

    if (wsStatus === "connected") {
      hasEverConnectedRef.current = true;
    }

    if (isOffline) {
      wasOfflineRef.current = true;

      return;
    }

    if (!isLive || !owner) {
      return;
    }

    const returningLive = wasOfflineRef.current;
    const starting = startedForOwnerRef.current !== owner;

    wasOfflineRef.current = false;

    if (!starting && !returningLive && !socketReconnected) {
      return;
    }

    startedForOwnerRef.current = owner;
    // Startup follows the page's own fetches, so recovery does not refresh the reads
    // again unless Replay sent something. Coming back or reconnecting always refreshes.
    void recovery.recover(returningLive || socketReconnected ? "resync" : "startup");
  }, [isLive, isOffline, owner, recovery, wsStatus]);

  // A growing pending count while Live means a mutation just failed on reachability: probe now.
  // Replay's removals and parks shrink the queue; while Offline the backoff probes anyway.
  const pendingCountRef = useRef<number | null>(null);

  useEffect(() => {
    if (!owner) return;

    let cancelled = false;

    const check = async () => {
      const pending = (await outbox.forOwner(owner, "pending")).length;

      if (cancelled) return;

      const previous = pendingCountRef.current;

      pendingCountRef.current = pending;

      if (previous !== null && pending > previous && !isOffline) probeNow();
    };

    pendingCountRef.current = null;
    void check();
    const unsubscribe = outbox.subscribe(() => void check());

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [outbox, owner, isOffline, probeNow]);

  // Every Live verdict drains queued work, which has no transition to wait for while Live.
  // Recovery is single-flight, so a verdict during a run adds nothing.
  useEffect(() => {
    if (!owner) return;

    return subscribeLiveProbes(() => {
      if (recovery.isSyncing()) return;

      void outbox.forOwner(owner, "pending").then((pending) => {
        if (pending.length > 0) void recovery.recover("queued");
      });
    });
  }, [outbox, owner, recovery, subscribeLiveProbes]);

  // On a cold start the applied owner is still null while the session resolves and
  // nothing foreign is in memory, so only a real live-owner mismatch counts.
  const switching = sessionUserId !== null && owner !== null && owner !== sessionUserId;

  return { owner, switching };
}
