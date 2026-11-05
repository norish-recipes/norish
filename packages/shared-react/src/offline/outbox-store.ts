/**
 * Persisted Outbox queue (ADR-0001 writes side).
 *
 * Backed by the storage adapter's Outbox, which assigns a strictly increasing
 * seq so entries keep FIFO order. Inputs are stored faithfully, so file uploads
 * survive. Entries are scoped per owner: Replay only ever touches the current
 * user's, and a departed user's stay dormant under their owner until that owner
 * signs in again (ADR-0009); only an explicitly confirmed sign-out discards a
 * queue.
 */

import type { NewOutboxEntry, OutboxEntry, OutboxEntryStatus, ParkedReason } from "./outbox-types";
import type { OfflineStorage } from "./storage";

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
  /** Notified (here and from other contexts sharing the storage) whenever the queue changes. */
  subscribe(listener: () => void): () => void;
}

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

  async function update(seq: number, patch: Partial<Omit<OutboxEntry, "seq">>): Promise<void> {
    const existing = await outbox.get(seq);

    if (!existing) {
      return;
    }

    await outbox.put({ ...existing, ...patch, seq });

    notify();
  }

  async function park(seq: number, reason: ParkedReason): Promise<void> {
    await update(seq, {
      status: reason === "conflict" ? "conflicted" : "parked",
      parkedReason: reason,
    });
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
    enqueue,
    loadAll: () => outbox.all(),
    forOwner,
    update,
    park,
    remove,
    size,
    subscribe,
  };
}
