import type { WebReadCacheScope } from "@/lib/offline-read-cache/types";

const CONFIRMED_SIGN_OUT_PREFIX = "norish:web-read-cache:confirmed-sign-out:";

function storageKey(backendOrigin: string): string {
  return `${CONFIRMED_SIGN_OUT_PREFIX}${encodeURIComponent(backendOrigin)}`;
}

function localStorageOrNull(): Storage | null {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getWebReadCacheConfirmedSignOutAt(backendOrigin: string): number | null {
  try {
    const value = localStorageOrNull()?.getItem(storageKey(backendOrigin));
    const occurredAt = value ? Number(value) : Number.NaN;

    return Number.isFinite(occurredAt) ? occurredAt : null;
  } catch {
    return null;
  }
}

export function recordWebReadCacheConfirmedSignOut(
  backendOrigin: string,
  occurredAt: number
): void {
  try {
    localStorageOrNull()?.setItem(storageKey(backendOrigin), String(occurredAt));
  } catch {
    // IndexedDB cleanup remains the primary path when browser storage is unavailable.
  }
}

export function isWebReadCacheScopeRestorable(
  scope: WebReadCacheScope,
  confirmedSignOutAt: number | null
): boolean {
  return confirmedSignOutAt === null || scope.confirmedAt > confirmedSignOutAt;
}
