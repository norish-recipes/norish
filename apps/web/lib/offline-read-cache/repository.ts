import type { OpenWebReadCacheDatabaseOptions } from "@/lib/offline-read-cache/database";
import type {
  PutWebReadCacheRecordInput,
  WebReadCacheInventory,
  WebReadCacheInventoryItem,
  WebReadCachePersistenceWarning,
  WebReadCacheRecord,
  WebReadCacheRecordCounts,
  WebReadCacheScope,
  WebReadCacheScopeIdentity,
} from "@/lib/offline-read-cache/types";
import {
  openWebReadCacheDatabase,
  requestResult,
  waitForTransaction,
  WEB_READ_CACHE_INDEXES,
  WEB_READ_CACHE_STORES,
  WebReadCacheOpenError,
} from "@/lib/offline-read-cache/database";
import { notifyWebReadCacheChanged } from "@/lib/offline-read-cache/events";
import {
  createEmptyWebReadCacheInventory,
  createWebReadCacheRecordId,
  createWebReadCacheScopeKey,
  EMPTY_WEB_READ_CACHE_COUNTS,
  isCompatibleWebReadCacheScope,
  serializeWebReadCacheQueryKey,
  WEB_READ_CACHE_SCHEMA_VERSION,
} from "@/lib/offline-read-cache/types";

export function toWebReadCachePersistenceWarning(
  error: unknown,
  recordKind?: WebReadCacheRecord["kind"]
): WebReadCachePersistenceWarning {
  const occurredAt = Date.now();

  if (error instanceof WebReadCacheOpenError) {
    return { code: error.code, message: error.message, recordKind, occurredAt };
  }

  if (error instanceof DOMException && error.name === "QuotaExceededError") {
    return {
      code: "quota-exceeded",
      message: "Browser storage quota prevented this data from being saved offline",
      recordKind,
      occurredAt,
    };
  }

  return {
    code: "write-failed",
    message: error instanceof Error ? error.message : "The offline cache update failed",
    recordKind,
    occurredAt,
  };
}

function updateInventoryItem(
  item: WebReadCacheInventoryItem,
  count: number,
  record: WebReadCacheRecord
): void {
  if (count === 0) return;

  item.count += count;
  item.dataUpdatedAt = Math.max(item.dataUpdatedAt ?? 0, record.dataUpdatedAt);
  item.persistedAt = Math.max(item.persistedAt ?? 0, record.persistedAt);
}

export class WebReadCacheRepository {
  constructor(private readonly databaseOptions: OpenWebReadCacheDatabaseOptions = {}) {}

  async getScope(scopeKey: string): Promise<WebReadCacheScope | null> {
    const database = await openWebReadCacheDatabase(this.databaseOptions);

    try {
      return (
        ((await requestResult(
          database
            .transaction(WEB_READ_CACHE_STORES.scopes, "readonly")
            .objectStore(WEB_READ_CACHE_STORES.scopes)
            .get(scopeKey)
        )) as WebReadCacheScope | undefined) ?? null
      );
    } finally {
      database.close();
    }
  }

  async confirmScope(
    input: Omit<
      WebReadCacheScope,
      | "key"
      | "schemaVersion"
      | "confirmedAt"
      | "updatedAt"
      | "lastLiveSuccessAt"
      | "persistenceWarning"
      | "active"
    > & { confirmedAt?: number; lastLiveSuccessAt?: number }
  ): Promise<WebReadCacheScope> {
    const now = input.confirmedAt ?? Date.now();
    const key = createWebReadCacheScopeKey(input);
    const database = await openWebReadCacheDatabase(this.databaseOptions);
    let scope: WebReadCacheScope;

    try {
      const transaction = database.transaction(WEB_READ_CACHE_STORES.scopes, "readwrite");
      const store = transaction.objectStore(WEB_READ_CACHE_STORES.scopes);
      const existing = (await requestResult(store.get(key))) as WebReadCacheScope | undefined;
      const allScopes = (await requestResult(store.getAll())) as WebReadCacheScope[];

      for (const candidate of allScopes) {
        if (
          candidate.active &&
          candidate.backendOrigin === input.backendOrigin &&
          candidate.schemaVersion === WEB_READ_CACHE_SCHEMA_VERSION &&
          candidate.key !== key
        ) {
          store.put({ ...candidate, active: false, updatedAt: now });
        }
      }

      scope = {
        ...existing,
        ...input,
        key,
        schemaVersion: WEB_READ_CACHE_SCHEMA_VERSION,
        confirmedAt: now,
        updatedAt: now,
        lastLiveSuccessAt: input.lastLiveSuccessAt ?? now,
        persistenceWarning: null,
        active: true,
      };
      store.put(scope);
      await waitForTransaction(transaction);
    } finally {
      database.close();
    }

    notifyWebReadCacheChanged({ type: "scope", scopeKey: key, occurredAt: now });

    return scope;
  }

  async selectLastConfirmedScope(backendOrigin: string): Promise<WebReadCacheScope | null> {
    const database = await openWebReadCacheDatabase(this.databaseOptions);

    try {
      const transaction = database.transaction(WEB_READ_CACHE_STORES.scopes, "readonly");
      const index = transaction
        .objectStore(WEB_READ_CACHE_STORES.scopes)
        .index(WEB_READ_CACHE_INDEXES.scopesByOriginSchema);
      const scopes = (await requestResult(
        index.getAll(IDBKeyRange.only([backendOrigin, WEB_READ_CACHE_SCHEMA_VERSION]))
      )) as WebReadCacheScope[];

      return (
        scopes
          .filter((scope) => scope.active)
          .sort((left, right) => right.confirmedAt - left.confirmedAt)[0] ?? null
      );
    } finally {
      database.close();
    }
  }

  async getCompatibleScope(identity: WebReadCacheScopeIdentity): Promise<WebReadCacheScope | null> {
    const scope = await this.getScope(createWebReadCacheScopeKey(identity));

    return scope && isCompatibleWebReadCacheScope(scope, identity) ? scope : null;
  }

  async clearConfirmedRenderScope(
    backendOrigin: string,
    confirmedBefore = Number.POSITIVE_INFINITY
  ): Promise<void> {
    const database = await openWebReadCacheDatabase(this.databaseOptions);
    const now = Date.now();

    try {
      const transaction = database.transaction(WEB_READ_CACHE_STORES.scopes, "readwrite");
      const store = transaction.objectStore(WEB_READ_CACHE_STORES.scopes);
      const scopes = (await requestResult(store.getAll())) as WebReadCacheScope[];

      for (const scope of scopes) {
        if (
          scope.backendOrigin === backendOrigin &&
          scope.active &&
          scope.confirmedAt <= confirmedBefore
        ) {
          store.put({ ...scope, active: false, updatedAt: now });
        }
      }

      await waitForTransaction(transaction);
    } finally {
      database.close();
    }

    notifyWebReadCacheChanged({ type: "scope", scopeKey: null, occurredAt: now });
  }

  async deactivateScope(scopeKey: string, confirmedAt: number): Promise<void> {
    const database = await openWebReadCacheDatabase(this.databaseOptions);
    const now = Date.now();
    let changed = false;

    try {
      const transaction = database.transaction(WEB_READ_CACHE_STORES.scopes, "readwrite");
      const store = transaction.objectStore(WEB_READ_CACHE_STORES.scopes);
      const scope = (await requestResult(store.get(scopeKey))) as WebReadCacheScope | undefined;

      if (scope?.active && scope.confirmedAt === confirmedAt) {
        store.put({ ...scope, active: false, updatedAt: now });
        changed = true;
      }

      await waitForTransaction(transaction);
    } finally {
      database.close();
    }

    if (changed) {
      notifyWebReadCacheChanged({ type: "scope", scopeKey, occurredAt: now });
    }
  }

  async putRecord<TData>(
    input: PutWebReadCacheRecordInput<TData>
  ): Promise<WebReadCacheRecord<TData>> {
    const now = input.now ?? Date.now();
    const counts: WebReadCacheRecordCounts = {
      ...EMPTY_WEB_READ_CACHE_COUNTS,
      ...input.counts,
    };
    const record: WebReadCacheRecord<TData> = {
      id: createWebReadCacheRecordId(input.scopeKey, input.queryKey),
      scopeKey: input.scopeKey,
      kind: input.kind,
      queryIdentity: serializeWebReadCacheQueryKey(input.queryKey),
      queryKey: input.queryKey,
      data: input.data,
      dataUpdatedAt: input.dataUpdatedAt,
      persistedAt: now,
      counts,
    };

    try {
      const database = await openWebReadCacheDatabase(this.databaseOptions);

      try {
        const transaction = database.transaction(
          [WEB_READ_CACHE_STORES.scopes, WEB_READ_CACHE_STORES.records],
          "readwrite"
        );
        const scopeStore = transaction.objectStore(WEB_READ_CACHE_STORES.scopes);
        const recordStore = transaction.objectStore(WEB_READ_CACHE_STORES.records);
        const scope = (await requestResult(scopeStore.get(input.scopeKey))) as
          | WebReadCacheScope
          | undefined;

        if (!scope) {
          transaction.abort();
          throw new Error("Cannot persist offline data without a confirmed cache scope");
        }

        const recordsOfKind = (await requestResult(
          recordStore
            .index(WEB_READ_CACHE_INDEXES.recordsByScopeKind)
            .getAll(IDBKeyRange.only([input.scopeKey, input.kind]))
        )) as WebReadCacheRecord[];

        for (const previous of recordsOfKind) {
          if (previous.id !== record.id) recordStore.delete(previous.id);
        }

        recordStore.put(record);
        scopeStore.put({
          ...scope,
          updatedAt: now,
          lastLiveSuccessAt: Math.max(scope.lastLiveSuccessAt ?? 0, input.dataUpdatedAt),
          persistenceWarning: null,
        });

        await waitForTransaction(transaction);
      } finally {
        database.close();
      }
    } catch (error) {
      await this.recordWarning(input.scopeKey, toWebReadCachePersistenceWarning(error, input.kind));
      throw error;
    }

    notifyWebReadCacheChanged({
      type: "commit",
      scopeKey: input.scopeKey,
      recordKind: input.kind,
      occurredAt: now,
    });

    return record;
  }

  async getRecord<TData = unknown>(
    scopeKey: string,
    queryKey: readonly unknown[]
  ): Promise<WebReadCacheRecord<TData> | null> {
    const database = await openWebReadCacheDatabase(this.databaseOptions);
    const id = createWebReadCacheRecordId(scopeKey, queryKey);

    try {
      const transaction = database.transaction(WEB_READ_CACHE_STORES.records, "readonly");
      const store = transaction.objectStore(WEB_READ_CACHE_STORES.records);
      const record = (await requestResult(store.get(id))) as WebReadCacheRecord<TData> | undefined;

      return record ?? null;
    } finally {
      database.close();
    }
  }

  async listRecords(scopeKey: string): Promise<WebReadCacheRecord[]> {
    const database = await openWebReadCacheDatabase(this.databaseOptions);

    try {
      const transaction = database.transaction(WEB_READ_CACHE_STORES.records, "readonly");

      return (await requestResult(
        transaction
          .objectStore(WEB_READ_CACHE_STORES.records)
          .index(WEB_READ_CACHE_INDEXES.recordsByScope)
          .getAll(IDBKeyRange.only(scopeKey))
      )) as WebReadCacheRecord[];
    } finally {
      database.close();
    }
  }

  async clearScope(scopeKey: string): Promise<void> {
    const database = await openWebReadCacheDatabase(this.databaseOptions);
    const now = Date.now();

    try {
      const transaction = database.transaction(WEB_READ_CACHE_STORES.records, "readwrite");
      const index = transaction
        .objectStore(WEB_READ_CACHE_STORES.records)
        .index(WEB_READ_CACHE_INDEXES.recordsByScope);
      const keys = await requestResult(index.getAllKeys(IDBKeyRange.only(scopeKey)));

      for (const key of keys) transaction.objectStore(WEB_READ_CACHE_STORES.records).delete(key);
      await waitForTransaction(transaction);
    } finally {
      database.close();
    }

    notifyWebReadCacheChanged({ type: "clear", scopeKey, occurredAt: now });
  }

  async getInventory(scopeKey: string | null): Promise<WebReadCacheInventory> {
    const empty = createEmptyWebReadCacheInventory(scopeKey);

    if (!scopeKey) return empty;

    const [scope, records] = await Promise.all([
      this.getScope(scopeKey),
      this.listRecords(scopeKey),
    ]);
    const inventory: WebReadCacheInventory = {
      ...empty,
      lastLiveSuccessAt: scope?.lastLiveSuccessAt ?? null,
      persistenceWarning: scope?.persistenceWarning ?? null,
      totalRecords: records.length,
    };

    for (const record of records) {
      updateInventoryItem(inventory.recipeSummaries, record.counts.recipeSummaries, record);
      updateInventoryItem(inventory.calendarItems, record.counts.calendarItems, record);
      updateInventoryItem(inventory.groceries, record.counts.groceries, record);
      updateInventoryItem(inventory.recurringGroceries, record.counts.recurringGroceries, record);
      updateInventoryItem(inventory.stores, record.counts.stores, record);
    }

    return inventory;
  }

  private async recordWarning(
    scopeKey: string,
    warning: WebReadCachePersistenceWarning
  ): Promise<void> {
    try {
      const database = await openWebReadCacheDatabase(this.databaseOptions);

      try {
        const transaction = database.transaction(WEB_READ_CACHE_STORES.scopes, "readwrite");
        const store = transaction.objectStore(WEB_READ_CACHE_STORES.scopes);
        const scope = (await requestResult(store.get(scopeKey))) as WebReadCacheScope | undefined;

        if (scope) {
          store.put({ ...scope, persistenceWarning: warning, updatedAt: warning.occurredAt });
          await waitForTransaction(transaction);
        }
      } finally {
        database.close();
      }
    } catch {
      // The warning still reaches same-tab consumers even when IDB itself is unavailable.
    }

    notifyWebReadCacheChanged({
      type: "warning",
      scopeKey,
      recordKind: warning.recordKind,
      occurredAt: warning.occurredAt,
    });
  }
}
