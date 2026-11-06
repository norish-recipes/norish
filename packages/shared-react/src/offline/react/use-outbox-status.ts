"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import type { OfflineEngine } from "../engine";
import type { OutboxEntry } from "../outbox-types";
import type { Recovery } from "../recovery";

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

export interface OutboxStatus {
  owner: string | null;
  outbox: OutboxSummary;
  isSyncing: boolean;
  syncNow: () => Promise<void>;
  /** Un-park every Parked and Conflicted entry, then replay. */
  retryAll: () => Promise<void>;
  /** Drop the whole queue, then reconcile the optimistic changes against the server. */
  discardAll: () => Promise<void>;
}

const noOwner = () => null;
const notSyncing = () => false;

/** The signed-in owner's live Outbox and the status actions (sync now, retry, discard). */
export function useOutboxStatus({
  engine: { cache, outbox, requeueParked, discardAll: discardQueue },
  recovery,
  canReachBackend,
  onSynced,
}: {
  engine: Pick<OfflineEngine, "cache" | "outbox" | "requeueParked" | "discardAll">;
  recovery: Recovery;
  /** Whether a sync is worth attempting now (web: false while Offline is forced). */
  canReachBackend: () => Promise<boolean>;
  /** After a sync or retry ran. */
  onSynced?: () => Promise<void>;
}): OutboxStatus {
  const owner = useSyncExternalStore(cache.subscribe, cache.owner, noOwner);
  const [entries, setEntries] = useState<OutboxEntry[]>([]);
  const [prevOwner, setPrevOwner] = useState(owner);
  const isSyncing = useSyncExternalStore(recovery.subscribe, recovery.isSyncing, notSyncing);

  // No owner (signed out): no Outbox to show.
  if (owner !== prevOwner) {
    setPrevOwner(owner);

    if (!owner) {
      setEntries([]);
    }
  }

  useEffect(() => {
    if (!owner) {
      return;
    }

    let cancelled = false;

    const load = () => {
      void outbox.forOwner(owner).then((next) => {
        if (!cancelled) {
          setEntries(next);
        }
      });
    };

    load();
    const unsubscribe = outbox.subscribe(load);

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [outbox, owner]);

  const summary = useMemo(() => summarize(entries), [entries]);

  const syncNow = useCallback(async () => {
    if (!(await canReachBackend())) {
      return;
    }

    await recovery.recover();
    await onSynced?.();
  }, [canReachBackend, onSynced, recovery]);

  const retryAll = useCallback(async () => {
    if (!owner || !(await canReachBackend())) {
      return;
    }

    await requeueParked(owner);
    await recovery.recover();
    await onSynced?.();
  }, [canReachBackend, onSynced, owner, recovery, requeueParked]);

  const discardAll = useCallback(async () => {
    if (!owner) {
      return;
    }

    await discardQueue(owner);
    // Best-effort while Offline; converges on reconnect.
    if (await canReachBackend()) {
      await recovery.recover();
    }
  }, [canReachBackend, discardQueue, owner, recovery]);

  return { owner, outbox: summary, isSyncing, syncNow, retryAll, discardAll };
}
