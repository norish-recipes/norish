// The persisted Outbox, FIFO by the adapter's seq. Replay touches only the current owner's
// entries; a departed owner's wait for their sign-in, unless a sign-out discards them (ADR-0009).

import { createClientId } from "@norish/shared/lib/operation-helpers";

import type { NewOutboxEntry, OutboxEntry, OutboxEntryStatus, ParkedReason } from "./outbox-types";
import type { OfflineStorage } from "./storage";

export interface OutboxStore {
  /** This store's id, which Replay marks an entry it sends with: a mark outlives its process. */
  readonly process: string;
  enqueue(entry: NewOutboxEntry): Promise<OutboxEntry>;
  /** All entries across all owners, in FIFO (seq) order. */
  loadAll(): Promise<OutboxEntry[]>;
  /** An owner's entries in FIFO order, optionally filtered by status. */
  forOwner(ownerId: string, status?: OutboxEntryStatus): Promise<OutboxEntry[]>;
  update(seq: number, patch: Partial<Omit<OutboxEntry, "seq">>): Promise<void>;
  /** Change one entry atomically (null deletes it); resolves with what was written. */
  change: OfflineStorage["outbox"]["change"];
  park(seq: number, reason: ParkedReason): Promise<void>;
  remove(seq: number): Promise<void>;
  size(ownerId?: string): Promise<number>;
  /** Notified (here and from other contexts sharing the storage) whenever the queue changes. */
  subscribe(listener: () => void): () => void;
}

export const parkedPatch = (reason: ParkedReason) =>
  ({
    status: reason === "conflict" ? "conflicted" : "parked",
    parkedReason: reason,
    sending: undefined,
  }) satisfies Partial<OutboxEntry>;

export function createOutboxStore(outbox: OfflineStorage["outbox"]): OutboxStore {
  const listeners = new Set<() => void>();

  function notify(): void {
    for (const listener of listeners) {
      listener();
    }
  }

  outbox.watch?.(notify);

  async function enqueue(entry: NewOutboxEntry): Promise<OutboxEntry> {
    const record: Omit<OutboxEntry, "seq"> = {
      createdAt: new Date().toISOString(),
      ...entry,
      attempts: 0,
      status: "pending",
    };

    // No seq on the record — the adapter assigns one atomically.
    const seq = await outbox.add(record);

    notify();

    return { ...record, seq };
  }

  async function forOwner(ownerId: string, status?: OutboxEntryStatus): Promise<OutboxEntry[]> {
    const all = await outbox.all();

    return all.filter(
      (entry) => entry.ownerId === ownerId && (status ? entry.status === status : true)
    );
  }

  async function change(...args: Parameters<OutboxStore["change"]>) {
    const written = await outbox.change(...args);

    if (written !== undefined) notify();

    return written;
  }

  // Atomic, so a save replacing the entry meanwhile is never written over.
  async function update(seq: number, patch: Partial<Omit<OutboxEntry, "seq">>): Promise<void> {
    await change(seq, (existing) => ({ ...existing, ...patch, seq }));
  }

  async function park(seq: number, reason: ParkedReason): Promise<void> {
    await update(seq, parkedPatch(reason));
  }

  async function remove(seq: number): Promise<void> {
    await outbox.remove(seq);
    notify();
  }

  async function size(ownerId?: string): Promise<number> {
    const all = await outbox.all();

    return ownerId ? all.filter((entry) => entry.ownerId === ownerId).length : all.length;
  }

  function subscribe(listener: () => void): () => void {
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }

  return {
    process: createClientId(),
    enqueue,
    loadAll: () => outbox.all(),
    forOwner,
    update,
    change,
    park,
    remove,
    size,
    subscribe,
  };
}
