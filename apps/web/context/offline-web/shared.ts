import type {
  WebReadCacheInventory,
  WebReadCachePersistenceWarning,
  WebReadCacheScope,
} from "@/lib/offline-read-cache";
import type { createOfflineReadCacheRegistry } from "@/lib/offline-read-cache/query-registry";
import type { QueryKey } from "@tanstack/react-query";
import { createEmptyWebReadCacheInventory } from "@/lib/offline-read-cache";

import type { User } from "@norish/shared/contracts";

export type OfflineWebPhase =
  | "probing-live"
  | "loading-fallback"
  | "cached"
  | "unavailable"
  | "recovering"
  | "live";

export type OfflineWebContextValue = {
  phase: OfflineWebPhase;
  activeScope: WebReadCacheScope | null;
  inventory: WebReadCacheInventory;
  persistenceWarning: WebReadCachePersistenceWarning | null;
  renderUser: User | null;
  renderIdentityOnly: boolean;
  usingCachedData: boolean;
  visibleDataUnavailable: boolean;
  getCachedQueryUpdatedAt: (queryKey: QueryKey) => number | null;
  hasResolvedQueryData: (queryKey: QueryKey) => boolean;
  isQueryLoadingFallback: (queryKey: QueryKey) => boolean;
  isQueryUsingCachedData: (queryKey: QueryKey) => boolean;
  isQueryUnavailable: (queryKey: QueryKey) => boolean;
  registerVisibleDataUnavailable: () => () => void;
  retryConnection: () => Promise<boolean>;
  clearCachedData: () => Promise<void>;
};

export type OfflineReadCacheRegistry = ReturnType<typeof createOfflineReadCacheRegistry>;

export type LiveSessionUser = {
  id: string;
  email: string;
  name: string;
  image?: string | null;
};

export const EMPTY_INVENTORY: WebReadCacheInventory = createEmptyWebReadCacheInventory();

export const FALLBACK_DEADLINE_MS = 2_500;
export const WRITE_THROTTLE_MS = 250;

export function shouldShowOfflineWebLoading(
  phase: OfflineWebPhase,
  queryIsLoading: boolean,
  queryHasSuccessfulData: boolean,
  queryIsLoadingFallback = false
): boolean {
  if (phase === "loading-fallback" || queryIsLoadingFallback) return !queryHasSuccessfulData;

  return queryIsLoading;
}

export function backendOrigin(): string {
  return typeof window === "undefined" ? "" : window.location.origin;
}

export function userFromSession(sessionUser: LiveSessionUser): User {
  return {
    id: sessionUser.id,
    email: sessionUser.email,
    name: sessionUser.name,
    image: sessionUser.image ?? null,
    version: 1,
  };
}

export function getHouseholdId(data: unknown, userId: string): string | null {
  if (!data || typeof data !== "object") return null;

  const household = (data as { household?: unknown }).household;

  if (household && typeof household === "object" && "id" in household) {
    const id = (household as { id?: unknown }).id;

    if (typeof id === "string") return id;
  }

  return `user:${userId}`;
}

export function getRenderHousehold(data: unknown): WebReadCacheScope["renderHousehold"] {
  if (!data || typeof data !== "object") return null;

  const household = (data as { household?: unknown }).household;

  if (!household || typeof household !== "object") return null;

  const { id, name } = household as { id?: unknown; name?: unknown };

  return typeof id === "string" && typeof name === "string" ? { id, name } : null;
}
