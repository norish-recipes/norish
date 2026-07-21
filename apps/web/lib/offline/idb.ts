/**
 * Low-level IndexedDB access for the web offline runtime.
 *
 * One database (`norish-offline`) holds every offline artefact so a single
 * connection and upgrade path govern them all:
 *
 *  - `keyval` — the persisted TanStack Query cache (one dehydrated blob per
 *    cache owner; see {@link ../query-cache/idb-persister}).
 *  - `outbox` — queued mutations awaiting Replay (added in a later commit).
 *
 * IndexedDB is chosen over `localStorage` because the Outbox must persist real
 * `File`/`Blob` inputs by structured clone, which string storage cannot do.
 *
 * The `IDBFactory` is injectable so the stores can be exercised against
 * `fake-indexeddb` in unit tests without a browser.
 */

export const OFFLINE_DB_NAME = "norish-offline";

/**
 * Schema version. Bump when adding an object store and extend
 * {@link applyUpgrade}; existing databases upgrade in place, so no store that
 * already holds data (notably the Outbox) is ever dropped.
 */
export const OFFLINE_DB_VERSION = 1;

export const KEYVAL_STORE = "keyval";

/** All object stores that exist at the current {@link OFFLINE_DB_VERSION}. */
export type OfflineStoreName = typeof KEYVAL_STORE;

function applyUpgrade(db: IDBDatabase, oldVersion: number): void {
  if (oldVersion < 1) {
    db.createObjectStore(KEYVAL_STORE);
  }
}

function resolveFactory(factory?: IDBFactory): IDBFactory {
  const resolved =
    factory ?? (typeof indexedDB !== "undefined" ? (indexedDB as IDBFactory) : undefined);

  if (!resolved) {
    throw new Error("IndexedDB is unavailable in this environment");
  }

  return resolved;
}

/**
 * A lazily-opened connection to the offline database, exposing the minimal
 * typed operations the persister and Outbox need. Create one per `IDBFactory`;
 * production code shares the default {@link offlineIdb}, tests build their own.
 */
export interface OfflineIdb {
  get<T>(store: OfflineStoreName, key: IDBValidKey): Promise<T | undefined>;
  set(store: OfflineStoreName, key: IDBValidKey, value: unknown): Promise<void>;
  del(store: OfflineStoreName, key: IDBValidKey): Promise<void>;
  keys(store: OfflineStoreName): Promise<IDBValidKey[]>;
}

export function createOfflineIdb(factory?: IDBFactory): OfflineIdb {
  let dbPromise: Promise<IDBDatabase> | null = null;

  function open(): Promise<IDBDatabase> {
    if (dbPromise) {
      return dbPromise;
    }

    const idb = resolveFactory(factory);

    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = idb.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);

      request.onupgradeneeded = (event) => applyUpgrade(request.result, event.oldVersion);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("IndexedDB upgrade blocked by another tab"));
    }).catch((error) => {
      // Let a later call retry rather than caching a rejected connection.
      dbPromise = null;
      throw error;
    });

    return dbPromise;
  }

  async function run<T>(
    store: OfflineStoreName,
    mode: IDBTransactionMode,
    body: (objectStore: IDBObjectStore) => IDBRequest<T>
  ): Promise<T> {
    const db = await open();

    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const request = body(tx.objectStore(store));

      tx.onabort = () => reject(tx.error ?? request.error);
      tx.oncomplete = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  return {
    async get<T>(store: OfflineStoreName, key: IDBValidKey): Promise<T | undefined> {
      return run<T | undefined>(store, "readonly", (objectStore) => objectStore.get(key));
    },
    async set(store: OfflineStoreName, key: IDBValidKey, value: unknown): Promise<void> {
      await run(store, "readwrite", (objectStore) => objectStore.put(value, key));
    },
    async del(store: OfflineStoreName, key: IDBValidKey): Promise<void> {
      await run(store, "readwrite", (objectStore) => objectStore.delete(key));
    },
    async keys(store: OfflineStoreName): Promise<IDBValidKey[]> {
      return run<IDBValidKey[]>(store, "readonly", (objectStore) => objectStore.getAllKeys());
    },
  };
}

/** Shared production connection. Tests pass an injected factory instead. */
export const offlineIdb: OfflineIdb = createOfflineIdb();
