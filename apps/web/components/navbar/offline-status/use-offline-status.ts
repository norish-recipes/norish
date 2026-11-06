"use client";

import { useCallback, useEffect, useState } from "react";
import { useConnectivity } from "@/app/providers/connectivity-provider";
import { useTRPC } from "@/app/providers/trpc-provider";
import { probeBackendReachable, setOfflineForced } from "@/lib/connectivity";
import { offlineEngine } from "@/lib/offline/engine";

import type { WarmSetInventory } from "@norish/shared-react/offline";
import type { OutboxSummary } from "@norish/shared-react/offline/react";
import { useOutboxStatus, useRecovery, useWarmSet } from "@norish/shared-react/offline/react";

/** Nothing cached: what the modal shows before a warm, and after a wipe. */
const EMPTY_INVENTORY: WarmSetInventory = {
  recipes: 0,
  cookbooks: 0,
  groceries: 0,
  stores: 0,
  plannedThisWeek: 0,
  lastCompletedAt: null,
};

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
  const warmSet = useWarmSet(offlineEngine, useTRPC());
  const [inventory, setInventory] = useState<WarmSetInventory>(EMPTY_INVENTORY);

  const refreshInventory = useCallback(async () => {
    setInventory(await warmSet.inspect());
  }, [warmSet]);

  const canReachBackend = useCallback(async () => {
    if (isForced) {
      return false;
    }

    return !isOffline || probeBackendReachable();
  }, [isForced, isOffline]);

  const { owner, outbox, isSyncing, syncNow, retryAll, discardAll } = useOutboxStatus({
    engine: offlineEngine,
    recovery,
    canReachBackend,
    onSynced: refreshInventory,
  });
  const [prevOwner, setPrevOwner] = useState(owner);

  // No owner (signed out): nothing cached to show.
  if (owner !== prevOwner) {
    setPrevOwner(owner);

    if (!owner) {
      setInventory(EMPTY_INVENTORY);
    }
  }

  // Read the Warm Set inventory when the modal opens.
  useEffect(() => {
    if (!owner) {
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

  const warm = useCallback(() => warmSet.topUp(), [warmSet]);

  const wipeCache = useCallback(async () => {
    await offlineEngine.cache.resetOfflineCopy("manual");
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
