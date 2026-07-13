const DATABASE_NAME = "norish-web-mutation-delivery";
const DATABASE_VERSION = 2;

export const OUTBOX_STORES = {
  keys: "keys",
  entries: "entries",
  results: "results",
} as const;

export function assertIndexedDbAvailable(): void {
  if (typeof indexedDB === "undefined") {
    throw new Error("IndexedDB is unavailable; durable mutation delivery cannot be enabled");
  }
}

export function openWebOutboxDatabase(): Promise<IDBDatabase> {
  assertIndexedDbAvailable();

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(OUTBOX_STORES.keys)) {
        database.createObjectStore(OUTBOX_STORES.keys, { keyPath: "id" });
      }

      if (!database.objectStoreNames.contains(OUTBOX_STORES.entries)) {
        const entries = database.createObjectStore(OUTBOX_STORES.entries, { keyPath: "id" });

        entries.createIndex("creationOrder", "creationOrder", { unique: false });
        entries.createIndex("backendOrigin", "backendOrigin", { unique: false });
        entries.createIndex("userId", "userId", { unique: false });
        entries.createIndex("state", "state", { unique: false });
      }

      const entries = request.transaction?.objectStore(OUTBOX_STORES.entries);

      if (entries && !entries.indexNames.contains("operationKey")) {
        entries.createIndex("operationKey", ["backendOrigin", "userId", "operationId", "path"], {
          unique: true,
        });
      }

      if (!database.objectStoreNames.contains(OUTBOX_STORES.results)) {
        const results = database.createObjectStore(OUTBOX_STORES.results, { keyPath: "id" });

        results.createIndex("userId", "userId", { unique: false });
        results.createIndex("createdAt", "createdAt", { unique: false });
      }
    };

    request.onsuccess = () => {
      const database = request.result;

      database.onversionchange = () => database.close();
      resolve(database);
    };
    request.onerror = () => reject(request.error ?? new Error("Unable to open IndexedDB"));
    request.onblocked = () => reject(new Error("IndexedDB upgrade is blocked by another tab"));
  });
}

export function waitForTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
  });
}

export function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}
