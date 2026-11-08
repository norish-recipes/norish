import type { OutboxEntry } from "../outbox-types";
import type { OfflineStorage } from "../storage";

/**
 * An in-memory storage adapter, for engine tests. Values are structured-cloned in and out,
 * so a value that could not be stored durably is rejected here too.
 */
export function createMemoryStorage(): OfflineStorage {
  const entries = new Map<number, OutboxEntry>();
  const values = new Map<string, unknown>();
  let owner: string | null = null;
  let nextSeq = 1;

  return {
    lastOwner: {
      get: () => owner,
      set: (next) => {
        owner = next;
      },
    },
    keyval: {
      get: async <T>(key: string) => structuredClone(values.get(key)) as T | undefined,
      set: async (key, value) => {
        values.set(key, structuredClone(value));
      },
      del: async (key) => {
        values.delete(key);
      },
      keys: async () => [...values.keys()],
    },
    outbox: {
      async add(entry) {
        const seq = nextSeq++;

        entries.set(seq, structuredClone({ ...entry, seq }));

        return seq;
      },
      all: async () =>
        [...entries.values()].sort((a, b) => a.seq - b.seq).map((entry) => structuredClone(entry)),
      get: async (seq) => {
        const stored = entries.get(seq);

        return stored && structuredClone(stored);
      },
      put: async (entry) => {
        entries.set(entry.seq, structuredClone(entry));
      },
      remove: async (seq) => {
        entries.delete(seq);
      },
    },
  };
}
