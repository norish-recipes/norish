"use client";

import type { OutboxEntry } from "@/lib/outbox";
import type { CacheStatusTRPC, OfflineCacheCounts, WarmerTRPC } from "@/lib/query-cache";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useConnectivity } from "@/app/providers/connectivity-provider";
import { useTRPC } from "@/app/providers/trpc-provider";
import { probeBackendReachable, setOfflineForced } from "@/lib/connectivity";
import {
  discardAllEntries,
  isReplaying,
  outboxStore,
  processQueue,
  retryParkedEntries,
  runIfLeader,
  runReconnectSequence,
  subscribeReplayState,
} from "@/lib/outbox";
import {
  activeCacheOwner,
  getOfflineCacheCounts,
  readLastWarmedAt,
  warmCache,
  wipeReadCache,
} from "@/lib/query-cache";
import { useQueryClient } from "@tanstack/react-query";

export interface OutboxSummary {
  entries: OutboxEntry[];
  total: number;
  pending: number;
  parked: number;
  conflicted: number;
}

function summarize(entries: OutboxEntry[]): OutboxSummary {
  return {
    entries,
    total: entries.length,
    pending: entries.filter((entry) => entry.status === "pending").length,
    parked: entries.filter((entry) => entry.status === "parked").length,
    conflicted: entries.filter((entry) => entry.status === "conflicted").length,
  };
}

export interface OfflineStatus {
  posture: ReturnType<typeof useConnectivity>["posture"];
  isLive: boolean;
  isOffline: boolean;
  isForced: boolean;
  counts: OfflineCacheCounts;
  lastWarmedAt: number | null;
  outbox: OutboxSummary;
  isReplaying: boolean;
  isSyncing: boolean;
  syncNow: () => Promise<void>;
  retryAll: () => Promise<void>;
  discardAll: () => Promise<void>;
  wipeCache: () => Promise<void>;
  setForcedOffline: (next: boolean) => void;
}

/**
 * Gathers everything the status modal renders — connectivity posture, cache
 * counts, the last-warmed timestamp and the live Outbox — and exposes the
 * actions it drives. Only mounted while the modal is open, so its effects (the
 * Outbox subscription, the IndexedDB reads) run just for that window.
 */
export function useOfflineStatus(): OfflineStatus {
  const { posture, isLive, isOffline, isForced } = useConnectivity();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const owner = activeCacheOwner();

  const [entries, setEntries] = useState<OutboxEntry[]>([]);
  const [lastWarmedAt, setLastWarmedAt] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const replaying = useSyncExternalStore(subscribeReplayState, isReplaying, () => false);

  // Keep the Outbox list live while open (in-tab and cross-tab).
  useEffect(() => {
    if (!owner) {
      setEntries([]);

      return;
    }

    let cancelled = false;

    const load = () => {
      void outboxStore.forOwner(owner).then((next) => {
        if (!cancelled) {
          setEntries(next);
        }
      });
    };

    load();
    const unsubscribe = outboxStore.subscribe(load);

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [owner]);

  // Read the last-warmed stamp when the modal opens.
  useEffect(() => {
    if (!owner) {
      return;
    }

    let cancelled = false;

    void readLastWarmedAt(owner).then((value) => {
      if (!cancelled) {
        setLastWarmedAt(value);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [owner]);

  const counts = getOfflineCacheCounts(queryClient, trpc as unknown as CacheStatusTRPC);
  const outbox = useMemo(() => summarize(entries), [entries]);

  const warm = useCallback(
    () => runIfLeader(() => warmCache({ trpc: trpc as unknown as WarmerTRPC, queryClient })),
    [trpc, queryClient]
  );

  const syncNow = useCallback(async () => {
    // The dev override blocks the transport entirely — there is nothing to sync.
    if (isForced) {
      return;
    }

    setIsSyncing(true);

    try {
      // Probe first when Offline so we don't drain into an unreachable backend.
      if (isOffline && !(await probeBackendReachable())) {
        return;
      }

      await runReconnectSequence({
        drain: () => processQueue(),
        invalidate: () => queryClient.invalidateQueries(),
        warm,
      });
    } finally {
      setIsSyncing(false);
    }
  }, [isForced, isOffline, queryClient, warm]);

  const retryAll = useCallback(async () => {
    if (owner) {
      await retryParkedEntries(owner);
    }
  }, [owner]);

  const discardAll = useCallback(async () => {
    if (!owner) {
      return;
    }

    await discardAllEntries(owner);
    // Reconcile the optimistically-applied changes against server truth so no
    // phantom lingers (best-effort while Offline; converges on reconnect).
    await queryClient.invalidateQueries();
  }, [owner, queryClient]);

  const wipeCache = useCallback(async () => {
    await wipeReadCache(queryClient);
    setLastWarmedAt(null);

    // Re-warm immediately when Live so the floor self-heals; Offline this simply
    // leaves an empty cache until reconnect.
    if (isLive) {
      await warm();

      if (owner) {
        setLastWarmedAt(await readLastWarmedAt(owner));
      }
    }
  }, [queryClient, isLive, warm, owner]);

  const setForcedOffline = useCallback((next: boolean) => {
    // Persist the flag then reload so every transport signal — the parked probe,
    // the blocked HTTP link, the dormant lazy WebSocket — re-derives cleanly from
    // the flag (ADR-0007). On exit this is the organic reconnect: a fresh boot
    // runs the Reconnect Sequence.
    setOfflineForced(next);
    window.location.reload();
  }, []);

  return {
    posture,
    isLive,
    isOffline,
    isForced,
    counts,
    lastWarmedAt,
    outbox,
    isReplaying: replaying,
    isSyncing,
    syncNow,
    retryAll,
    discardAll,
    wipeCache,
    setForcedOffline,
  };
}
