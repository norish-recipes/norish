// The offline engine's storage in IndexedDB (uploads by structured clone), the owner in
// localStorage, and cross-tab Outbox notices over a BroadcastChannel.

import { deletePersonalCaches } from "@/lib/offline/cache-names";
import { createOfflineIdb, KEYVAL_STORE, OUTBOX_STORE } from "@/lib/offline/idb";

import type { OfflineStorage, OutboxEntry } from "@norish/shared-react/offline";

/** `localStorage` key holding the last-known cache owner id. */
export const CACHE_OWNER_STORAGE_KEY = "norish.offline.cache-owner";

/** Broadcast channel name used to notify other tabs the queue changed. */
const OUTBOX_CHANNEL = "norish-outbox";

function readLastOwner(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const value = window.localStorage.getItem(CACHE_OWNER_STORAGE_KEY);

    return value && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

function writeLastOwner(ownerId: string | null): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (ownerId) {
      window.localStorage.setItem(CACHE_OWNER_STORAGE_KEY, ownerId);
    } else {
      window.localStorage.removeItem(CACHE_OWNER_STORAGE_KEY);
    }
  } catch {
    // Private-mode or quota failure: identity degrades to in-memory only.
  }
}

/** The `IDBFactory` is injectable so tests run the adapter against `fake-indexeddb`. */
export function createIdbStorage(factory?: IDBFactory): OfflineStorage {
  const idb = createOfflineIdb(factory);
  const channel =
    typeof BroadcastChannel !== "undefined" ? new BroadcastChannel(OUTBOX_CHANNEL) : null;
  const changed = () => channel?.postMessage("changed");

  return {
    lastOwner: { get: readLastOwner, set: writeLastOwner },
    keyval: {
      get: (key) => idb.get(KEYVAL_STORE, key),
      set: (key, value) => idb.set(KEYVAL_STORE, key, value),
      del: (key) => idb.del(KEYVAL_STORE, key),
      keys: async () =>
        (await idb.keys(KEYVAL_STORE)).filter((key): key is string => typeof key === "string"),
    },
    outbox: {
      async add(entry) {
        // No seq on the record — autoIncrement assigns one atomically.
        const seq = (await idb.transaction<IDBValidKey>(OUTBOX_STORE, "readwrite", (store) =>
          store.add(entry)
        )) as number;

        changed();

        return seq;
      },
      // getAll returns records in ascending key (seq) order — i.e. FIFO.
      all: () =>
        idb.transaction<OutboxEntry[]>(OUTBOX_STORE, "readonly", (store) => store.getAll()),
      get: (seq) =>
        idb.transaction<OutboxEntry | undefined>(OUTBOX_STORE, "readonly", (store) =>
          store.get(seq)
        ),
      async put(entry) {
        await idb.transaction(OUTBOX_STORE, "readwrite", (store) => store.put(entry));
        changed();
      },
      async remove(seq) {
        await idb.transaction(OUTBOX_STORE, "readwrite", (store) => store.delete(seq));
        changed();
      },
      watch(listener) {
        if (!channel) {
          return () => {};
        }

        const onMessage = () => listener();

        channel.addEventListener("message", onMessage);

        return () => channel.removeEventListener("message", onMessage);
      },
    },
    clearPersonalCaches: deletePersonalCaches,
  };
}
