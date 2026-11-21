"use client";

import { useSyncExternalStore } from "react";

import type { CacheManager } from "../cache-manager";

const noOwner = () => null;

/** The owner whose Offline Cache is restored, null before any restore or while signed out. */
export function useCacheOwner(cache: Pick<CacheManager, "subscribe" | "owner">): string | null {
  return useSyncExternalStore(cache.subscribe, cache.owner, noOwner);
}
