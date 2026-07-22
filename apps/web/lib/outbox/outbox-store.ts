/**
 * Persisted Outbox queue (ADR-0001 writes side).
 *
 * Backed by the auto-incrementing `outbox` object store so entries keep strict
 * FIFO order and appends are atomic across tabs. Inputs are stored by structured
 * clone, so file uploads survive. Entries are scoped per owner: Replay only ever
 * touches the current user's, and a departed user's stay dormant under their
 * owner until that owner signs in again (ADR-0009); only an explicitly
 * confirmed sign-out discards a queue.
 *
 * The store is a factory over an injectable {@link OfflineIdb} so it can be
 * tested against `fake-indexeddb`; the app shares the module-level default.
 */

import type { OfflineIdb } from "@/lib/offline/idb";
import { offlineIdb, OUTBOX_STORE } from "@/lib/offline/idb";

import type { NewOutboxEntry, OutboxEntry, OutboxEntryStatus, ParkedReason } from "./outbox-types";

/** Broadcast channel name used to notify other tabs the queue changed. */
const OUTBOX_CHANNEL = "norish-outbox";

export interface OutboxStore {
  enqueue(entry: NewOutboxEntry): Promise<OutboxEntry>;
  /** All entries across all owners, in FIFO (seq) order. */
  loadAll(): Promise<OutboxEntry[]>;
  /** An owner's entries in FIFO order, optionally filtered by status. */
  forOwner(ownerId: string, status?: OutboxEntryStatus): Promise<OutboxEntry[]>;
  update(seq: number, patch: Partial<Omit<OutboxEntry, "seq">>): Promise<void>;
  park(seq: number, reason: ParkedReason): Promise<void>;
  remove(seq: number): Promise<void>;
  size(ownerId?: string): Promise<number>;
  /** Notified (in-tab and cross-tab) whenever the queue changes. */
  subscribe(listener: () => void): () => void;
}

export function createOutboxStore(idb: OfflineIdb): OutboxStore {
  const listeners = new Set<() => void>();

  const channel =
    typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(OUTBOX_CHANNEL) : null;

  if (channel) {
    channel.onmessage = () => {
      for (const listener of listeners) {
        listener();
      }
    };
  }

  function notify(): void {
    for (const listener of listeners) {
      listener();
    }

    channel?.postMessage("changed");
  }

  async function getAll(): Promise<OutboxEntry[]> {
    // getAll returns records in ascending key (seq) order — i.e. FIFO.
    return idb.transaction<OutboxEntry[]>(OUTBOX_STORE, "readonly", (store) => store.getAll());
  }

  async function enqueue(entry: NewOutboxEntry): Promise<OutboxEntry> {
    const record: Omit<OutboxEntry, "seq"> = {
      createdAt: new Date().toISOString(),
      ...entry,
      attempts: 0,
      status: "pending",
    };

    const seq = (await idb.transaction<IDBValidKey>(OUTBOX_STORE, "readwrite", (store) =>
      // No seq on the record — autoIncrement assigns one atomically.
      store.add(record)
    )) as number;

    notify();

    return { ...record, seq };
  }

  async function forOwner(ownerId: string, status?: OutboxEntryStatus): Promise<OutboxEntry[]> {
    const all = await getAll();

    return all.filter(
      (entry) => entry.ownerId === ownerId && (status ? entry.status === status : true)
    );
  }

  async function update(seq: number, patch: Partial<Omit<OutboxEntry, "seq">>): Promise<void> {
    const existing = await idb.transaction<OutboxEntry | undefined>(
      OUTBOX_STORE,
      "readonly",
      (store) => store.get(seq)
    );

    if (!existing) {
      return;
    }

    await idb.transaction(OUTBOX_STORE, "readwrite", (store) =>
      store.put({ ...existing, ...patch, seq })
    );

    notify();
  }

  async function park(seq: number, reason: ParkedReason): Promise<void> {
    await update(seq, {
      status: reason === "conflict" ? "conflicted" : "parked",
      parkedReason: reason,
    });
  }

  async function remove(seq: number): Promise<void> {
    await idb.transaction(OUTBOX_STORE, "readwrite", (store) => store.delete(seq));
    notify();
  }

  async function size(ownerId?: string): Promise<number> {
    const all = await getAll();

    return ownerId ? all.filter((entry) => entry.ownerId === ownerId).length : all.length;
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }

  return {
    enqueue,
    loadAll: getAll,
    forOwner,
    update,
    park,
    remove,
    size,
    subscribe,
  };
}

/** Shared production store. Tests build their own over an injected `OfflineIdb`. */
export const outboxStore: OutboxStore = createOutboxStore(offlineIdb);
