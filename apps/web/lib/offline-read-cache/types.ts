import type { QueryKey } from "@tanstack/react-query";
import { hashKey } from "@tanstack/react-query";

export const WEB_READ_CACHE_DATABASE_NAME = "norish-web-read-cache";
export const WEB_READ_CACHE_DATABASE_VERSION = 3;
export const WEB_READ_CACHE_SCHEMA_VERSION = 2;

export type WebReadCacheRecordKind = "recipe-dashboard" | "calendar-range" | "groceries" | "stores";

export type WebReadCachePersistenceWarningCode =
  | "blocked"
  | "unavailable"
  | "quota-exceeded"
  | "write-failed";

export type WebReadCachePersistenceWarning = {
  code: WebReadCachePersistenceWarningCode;
  message: string;
  recordKind?: WebReadCacheRecordKind;
  occurredAt: number;
};

export type WebReadCacheRenderUser = {
  id: string;
  email: string;
  name: string;
  image: string | null;
  version: number;
};

export type WebReadCacheRenderHousehold = {
  id: string;
  name: string;
};

export type WebReadCacheScopeIdentity = {
  backendOrigin: string;
  userId: string;
  householdId: string | null;
  schemaVersion?: number;
};

export type WebReadCacheScope = {
  key: string;
  backendOrigin: string;
  userId: string;
  householdId: string | null;
  schemaVersion: number;
  renderUser: WebReadCacheRenderUser;
  renderHousehold: WebReadCacheRenderHousehold | null;
  householdQueryKey: QueryKey | null;
  confirmedAt: number;
  updatedAt: number;
  lastLiveSuccessAt: number | null;
  persistenceWarning: WebReadCachePersistenceWarning | null;
  active: boolean;
};

export type WebReadCacheRecordCounts = {
  recipeSummaries: number;
  calendarItems: number;
  groceries: number;
  recurringGroceries: number;
  recipeNameMappings: number;
  stores: number;
};

export type WebReadCacheRecord<TData = unknown> = {
  id: string;
  scopeKey: string;
  kind: WebReadCacheRecordKind;
  queryIdentity: string;
  queryKey: QueryKey;
  data: TData;
  dataUpdatedAt: number;
  persistedAt: number;
  counts: WebReadCacheRecordCounts;
};

export type PutWebReadCacheRecordInput<TData = unknown> = {
  scopeKey: string;
  kind: WebReadCacheRecordKind;
  queryKey: QueryKey;
  data: TData;
  dataUpdatedAt: number;
  counts?: Partial<WebReadCacheRecordCounts>;
  now?: number;
};

export type WebReadCacheInventoryItem = {
  count: number;
  dataUpdatedAt: number | null;
  persistedAt: number | null;
};

export type WebReadCacheInventory = {
  scopeKey: string | null;
  schemaVersion: number;
  lastLiveSuccessAt: number | null;
  persistenceWarning: WebReadCachePersistenceWarning | null;
  recipeSummaries: WebReadCacheInventoryItem;
  calendarItems: WebReadCacheInventoryItem;
  groceries: WebReadCacheInventoryItem;
  recurringGroceries: WebReadCacheInventoryItem;
  stores: WebReadCacheInventoryItem;
  totalRecords: number;
};

export function createEmptyWebReadCacheInventory(
  scopeKey: string | null = null
): WebReadCacheInventory {
  const item = (): WebReadCacheInventoryItem => ({
    count: 0,
    dataUpdatedAt: null,
    persistedAt: null,
  });

  return {
    scopeKey,
    schemaVersion: WEB_READ_CACHE_SCHEMA_VERSION,
    lastLiveSuccessAt: null,
    persistenceWarning: null,
    recipeSummaries: item(),
    calendarItems: item(),
    groceries: item(),
    recurringGroceries: item(),
    stores: item(),
    totalRecords: 0,
  };
}

export type WebReadCacheChangeType = "commit" | "clear" | "scope" | "warning";

export type WebReadCacheChange = {
  type: WebReadCacheChangeType;
  scopeKey: string | null;
  recordKind?: WebReadCacheRecordKind;
  occurredAt: number;
};

export const EMPTY_WEB_READ_CACHE_COUNTS: WebReadCacheRecordCounts = {
  recipeSummaries: 0,
  calendarItems: 0,
  groceries: 0,
  recurringGroceries: 0,
  recipeNameMappings: 0,
  stores: 0,
};

export function createWebReadCacheScopeKey(identity: WebReadCacheScopeIdentity): string {
  const schemaVersion = identity.schemaVersion ?? WEB_READ_CACHE_SCHEMA_VERSION;

  return JSON.stringify([
    schemaVersion,
    identity.backendOrigin,
    identity.userId,
    identity.householdId,
  ]);
}

export function serializeWebReadCacheQueryKey(queryKey: QueryKey): string {
  return hashKey(queryKey);
}

export function createWebReadCacheRecordId(scopeKey: string, queryKey: QueryKey): string {
  return `${scopeKey}:${serializeWebReadCacheQueryKey(queryKey)}`;
}

export function isCompatibleWebReadCacheScope(
  scope: WebReadCacheScope,
  identity: WebReadCacheScopeIdentity
): boolean {
  return (
    scope.schemaVersion === (identity.schemaVersion ?? WEB_READ_CACHE_SCHEMA_VERSION) &&
    scope.backendOrigin === identity.backendOrigin &&
    scope.userId === identity.userId &&
    scope.householdId === identity.householdId
  );
}
