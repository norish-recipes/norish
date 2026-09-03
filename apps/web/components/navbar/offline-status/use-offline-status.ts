"use client";

import type { OutboxEntry } from "@/lib/outbox";
import type { WarmSetInventory } from "@/lib/query-cache";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useConnectivity } from "@/app/providers/connectivity-provider";
import { useRecovery } from "@/app/providers/recovery-provider";
import { useWarmSet } from "@/hooks/use-warm-set";
import { probeBackendReachable, setOfflineForced } from "@/lib/connectivity";
import { discardAllEntries, outboxStore, requeueParkedEntries } from "@/lib/outbox";
import { cacheManager } from "@/lib/query-cache";

/** Nothing cached: what the modal shows before a warm, and after a wipe. */
const EMPTY_INVENTORY: WarmSetInventory = {
  recipes: 0,
  cookbooks: 0,
  groceries: 0,
  stores: 0,
  plannedThisWeek: 0,
  lastCompletedAt: null,
};

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
  counts: Omit<WarmSetInventory, "lastCompletedAt">;
  lastWarmedAt: number | null;
  outbox: OutboxSummary;
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
  const recovery = useRecovery();
  const warmSet = useWarmSet();
  const owner = useSyncExternalStore(cacheManager.subscribe, cacheManager.owner, () => null);

  const [entries, setEntries] = useState<OutboxEntry[]>([]);
  const [inventory, setInventory] = useState<WarmSetInventory>(EMPTY_INVENTORY);
  const isSyncing = useSyncExternalStore(recovery.subscribe, recovery.isSyncing, () => false);

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

  // Read the Warm Set inventory when the modal opens.
  useEffect(() => {
    if (!owner) {
      setInventory(EMPTY_INVENTORY);

      return;
    }

    let cancelled = false;

    void warmSet.inspect().then((value) => {
      if (!cancelled) {
        setInventory(value);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [owner, warmSet]);

  const { lastCompletedAt: lastWarmedAt, ...counts } = inventory;
  const outbox = useMemo(() => summarize(entries), [entries]);

  const warm = useCallback(() => warmSet.topUp(), [warmSet]);

  const refreshInventory = useCallback(async () => {
    setInventory(await warmSet.inspect());
  }, [warmSet]);

  const canReachBackend = useCallback(async () => {
    if (isForced) {
      return false;
    }

    return !isOffline || probeBackendReachable();
  }, [isForced, isOffline]);

  const syncNow = useCallback(async () => {
    if (!(await canReachBackend())) {
      return;
    }

    await recovery.recover();
    await refreshInventory();
  }, [canReachBackend, recovery, refreshInventory]);

  const retryAll = useCallback(async () => {
    if (!owner || !(await canReachBackend())) {
      return;
    }

    await requeueParkedEntries(owner);
    await recovery.recover();
    await refreshInventory();
  }, [canReachBackend, owner, recovery, refreshInventory]);

  const discardAll = useCallback(async () => {
    if (!owner) {
      return;
    }

    await discardAllEntries(owner);
    // Reconcile the optimistically-applied changes against server truth so no
    // phantom lingers (best-effort while Offline; converges on reconnect).
    if (await canReachBackend()) {
      await recovery.recover();
    }
  }, [canReachBackend, owner, recovery]);

  const wipeCache = useCallback(async () => {
    await cacheManager.resetOfflineCopy("manual");
    setInventory(EMPTY_INVENTORY);

    // Re-warm immediately when Live so the floor self-heals; Offline this simply
    // leaves an empty cache until reconnect.
    if (isLive) {
      await warm();
      await refreshInventory();
    }
  }, [isLive, warm, refreshInventory]);

  const setForcedOffline = useCallback((next: boolean) => {
    setOfflineForced(next);

    if (next) {
      // Entering: persist the flag then reload so every transport signal — the
      // parked probe, the blocked HTTP link, the already-open WebSocket —
      // re-derives cleanly from the flag (ADR-0007). The reload is artifact-free
      // because the dev link blocks mount refetches while forced, so restored
      // optimistic state holds.
      window.location.reload();
    }
    // Exiting reuses the organic Offline→Live path (ADR-0007): clearing the flag
    // resumes the probe loop, the dev link forwards its held subscriptions to
    // the real transport (the WebSocket un-suspends), and Recovery converges the
    // Outbox and read copy.
  }, []);

  return {
    posture,
    isLive,
    isOffline,
    isForced,
    counts,
    lastWarmedAt,
    outbox,
    isSyncing,
    syncNow,
    retryAll,
    discardAll,
    wipeCache,
    setForcedOffline,
  };
}
