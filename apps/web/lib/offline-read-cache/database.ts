import {
  createWebReadCacheRecordId,
  serializeWebReadCacheQueryKey,
  WEB_READ_CACHE_DATABASE_NAME,
  WEB_READ_CACHE_DATABASE_VERSION,
} from "@/lib/offline-read-cache/types";

export const WEB_READ_CACHE_STORES = {
  scopes: "scopes",
  records: "records",
} as const;

export const WEB_READ_CACHE_INDEXES = {
  scopesByOriginSchema: "by-origin-schema",
  recordsByScope: "by-scope",
  recordsByScopeKind: "by-scope-kind",
} as const;

export type OpenWebReadCacheDatabaseOptions = {
  factory?: IDBFactory;
  onBlocked?: () => void;
};

export class WebReadCacheOpenError extends Error {
  readonly code: "blocked" | "unavailable";

  constructor(code: "blocked" | "unavailable", message: string) {
    super(message);
    this.name = "WebReadCacheOpenError";
    this.code = code;
  }
}

export function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

export function waitForTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction was aborted"));
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction failed"));
  });
}

function migrateCanonicalRecordIdentities(recordStore: IDBObjectStore): void {
  const request = recordStore.openCursor();

  request.onsuccess = () => {
    const cursor = request.result;

    if (!cursor) return;

    const record = cursor.value as {
      id?: unknown;
      scopeKey?: unknown;
      queryIdentity?: unknown;
      queryKey?: unknown;
    };

    if (
      typeof record.id === "string" &&
      typeof record.scopeKey === "string" &&
      Array.isArray(record.queryKey)
    ) {
      const queryIdentity = serializeWebReadCacheQueryKey(record.queryKey);
      const id = createWebReadCacheRecordId(record.scopeKey, record.queryKey);

      if (record.id !== id || record.queryIdentity !== queryIdentity) {
        cursor.delete();
        recordStore.put({ ...record, id, queryIdentity });
      }
    }

    cursor.continue();
  };
}

function ensureSchema(
  database: IDBDatabase,
  transaction: IDBTransaction | null,
  oldVersion: number
): void {
  const scopeStore = database.objectStoreNames.contains(WEB_READ_CACHE_STORES.scopes)
    ? transaction?.objectStore(WEB_READ_CACHE_STORES.scopes)
    : database.createObjectStore(WEB_READ_CACHE_STORES.scopes, { keyPath: "key" });

  if (scopeStore && !scopeStore.indexNames.contains(WEB_READ_CACHE_INDEXES.scopesByOriginSchema)) {
    scopeStore.createIndex(
      WEB_READ_CACHE_INDEXES.scopesByOriginSchema,
      ["backendOrigin", "schemaVersion"],
      { unique: false }
    );
  }

  const recordStore = database.objectStoreNames.contains(WEB_READ_CACHE_STORES.records)
    ? transaction?.objectStore(WEB_READ_CACHE_STORES.records)
    : database.createObjectStore(WEB_READ_CACHE_STORES.records, { keyPath: "id" });

  if (recordStore && !recordStore.indexNames.contains(WEB_READ_CACHE_INDEXES.recordsByScope)) {
    recordStore.createIndex(WEB_READ_CACHE_INDEXES.recordsByScope, "scopeKey", { unique: false });
  }

  if (recordStore && !recordStore.indexNames.contains(WEB_READ_CACHE_INDEXES.recordsByScopeKind)) {
    recordStore.createIndex(WEB_READ_CACHE_INDEXES.recordsByScopeKind, ["scopeKey", "kind"], {
      unique: false,
    });
  }

  if (recordStore && oldVersion > 0 && oldVersion < 3) {
    migrateCanonicalRecordIdentities(recordStore);
  }
}

export function openWebReadCacheDatabase(
  options: OpenWebReadCacheDatabaseOptions = {}
): Promise<IDBDatabase> {
  const factory = options.factory ?? globalThis.indexedDB;

  if (!factory) {
    return Promise.reject(
      new WebReadCacheOpenError("unavailable", "IndexedDB is unavailable in this browser")
    );
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const request = factory.open(WEB_READ_CACHE_DATABASE_NAME, WEB_READ_CACHE_DATABASE_VERSION);

    request.onupgradeneeded = (event) =>
      ensureSchema(request.result, request.transaction, event.oldVersion);
    request.onblocked = () => {
      options.onBlocked?.();

      if (!settled) {
        settled = true;
        reject(
          new WebReadCacheOpenError(
            "blocked",
            "Another tab is blocking the offline read-cache upgrade"
          )
        );
      }
    };
    request.onerror = () => {
      if (settled) return;
      settled = true;
      reject(
        new WebReadCacheOpenError(
          "unavailable",
          request.error?.message ?? "The offline read cache could not be opened"
        )
      );
    };
    request.onsuccess = () => {
      if (settled) {
        request.result.close();

        return;
      }

      settled = true;
      const database = request.result;

      database.onversionchange = () => database.close();
      resolve(database);
    };
  });
}
