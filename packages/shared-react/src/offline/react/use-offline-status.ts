"use client";

import { useCallback, useEffect, useState } from "react";

import type { OfflineEngine } from "../engine";
import type { WarmSetInventory } from "../warm-set";
import type { ConnectivityPosture } from "./connectivity";
import type { OutboxSummary } from "./use-outbox-status";
import { useConnectivity } from "./connectivity";
import { useRecovery } from "./recovery-context";
import { useOutboxStatus } from "./use-outbox-status";
import { useWarmSet } from "./use-warm-set";

/** Nothing cached: what the status shows before a warm, and after a wipe. */
const EMPTY_INVENTORY: WarmSetInventory = {
  recipes: 0,
  cookbooks: 0,
  groceries: 0,
  stores: 0,
  plannedThisWeek: 0,
  lastCompletedAt: null,
};

export interface OfflineStatus {
  posture: ConnectivityPosture;
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
}

/** Connectivity, the Warm Set inventory and the live Outbox, with the status actions. */
export function useOfflineStatus(
  engine: Pick<
    OfflineEngine,
    "cache" | "outbox" | "requeueParked" | "discardAll" | "createWarmSet" | "probe"
  >
): OfflineStatus {
  const { posture, isLive, isOffline, isForced } = useConnectivity();
  const recovery = useRecovery();
  const warmSet = useWarmSet(engine);
  const [inventory, setInventory] = useState<WarmSetInventory>(EMPTY_INVENTORY);

  const refreshInventory = useCallback(async () => {
    setInventory(await warmSet.inspect());
  }, [warmSet]);

  // Forced Offline blocks the transport, so no sync is worth trying.
  const canReachBackend = useCallback(async () => {
    if (isForced) {
      return false;
    }

    return !isOffline || engine.probe();
  }, [engine, isForced, isOffline]);

  const { owner, outbox, isSyncing, syncNow, retryAll, discardAll } = useOutboxStatus({
    engine,
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

  const wipeCache = useCallback(async () => {
    await engine.cache.resetOfflineCopy("manual");
    setInventory(EMPTY_INVENTORY);

    // Re-warm at once while Live so the floor heals; Offline the cache stays empty until reconnect.
    if (isLive) {
      await warmSet.topUp();
      await refreshInventory();
    }
  }, [engine, isLive, warmSet, refreshInventory]);

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
  };
}
