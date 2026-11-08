// Everything the offline engine keeps durably; each client supplies an adapter that passes
// `describeOfflineStorageContract` (web: IndexedDB, mobile: MMKV).

import type { OutboxEntry } from "./outbox-types";

export interface OfflineStorage {
  /**
   * The last-known cache owner. Synchronous because boot reads it before any session can answer,
   * so an Offline launch restores the returning user's cache (ADR-0005).
   */
  lastOwner: {
    get(): string | null;
    set(ownerId: string | null): void;
  };
  /** Per-owner Offline Cache artefacts (the persisted query cache, the last-warmed time). */
  keyval: {
    get<T>(key: string): Promise<T | undefined>;
    set(key: string, value: unknown): Promise<void>;
    del(key: string): Promise<void>;
    keys(): Promise<string[]>;
  };
  /** The durable Outbox. Entries carry their owner, so every owner's queue shares one FIFO. */
  outbox: {
    // Resolves with a seq above every one ever assigned, blobs stored with it. A rejection
    // fails the mutation's admission (ADR-0009).
    add(entry: Omit<OutboxEntry, "seq">): Promise<number>;
    /** Every entry, in ascending seq (FIFO) order, blobs readable again. */
    all(): Promise<OutboxEntry[]>;
    get(seq: number): Promise<OutboxEntry | undefined>;
    /** Replace an existing entry (status, attempts); its stored blobs stay valid. */
    put(entry: OutboxEntry): Promise<void>;
    /** Delete an entry and whatever blobs were stored for it. */
    remove(seq: number): Promise<void>;
    /** Hear changes another context sharing this storage made (another browser tab). */
    watch?(listener: () => void): () => void;
  };
  /** Drop platform caches that hold personal data without an owner (web: images and pages). */
  clearPersonalCaches?(): Promise<void>;
}
