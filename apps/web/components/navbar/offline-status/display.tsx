"use client";

import type { WebConnectivityState } from "@/lib/connectivity";

export type OfflineDataState = "live" | "cached" | "stale" | "unavailable";

export function connectivityColor(state: WebConnectivityState) {
  if (state === "online") return "success" as const;
  if (state === "checking") return "default" as const;

  return "danger" as const;
}

export function dataColor(state: OfflineDataState) {
  if (state === "live") return "success" as const;
  if (state === "unavailable") return "danger" as const;

  return "warning" as const;
}
