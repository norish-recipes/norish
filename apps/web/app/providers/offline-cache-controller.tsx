"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useConnectivity } from "@/app/providers/connectivity-provider";
import { useTRPC } from "@/app/providers/trpc-provider";
import { useUserContext } from "@/context/user-context";
import { useQueryClient } from "@tanstack/react-query";

import { activeCacheOwner, resolveCacheOwner, warmCache, type WarmerTRPC } from "@/lib/query-cache";

/**
 * Drives the persisted Offline Cache from the two runtime signals it depends on:
 * the authenticated user id (per-user scoping, ADR-0005) and connectivity
 * (the Warmer only runs while Live).
 *
 * It sits below both `UserProvider` and `ConnectivityProvider` so it can read
 * those, and below `TRPCProviderWrapper` so the Warmer prefetches through the
 * same QueryClient the app renders from. It renders its children unchanged.
 *
 * Restore/switch/purge live in the cache manager; this component only feeds it
 * identity + connectivity and kicks off warming once an owner is settled.
 */
export function OfflineCacheController({ children }: { children: ReactNode }) {
  const { user } = useUserContext();
  const { isLive, isOffline } = useConnectivity();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const sessionUserId = user?.id ?? null;
  const [readyOwner, setReadyOwner] = useState<string | null>(null);

  // Reconcile the persisted cache with the current identity. Idempotent in the
  // manager, so re-running on every identity/connectivity change is safe.
  useEffect(() => {
    let cancelled = false;

    void resolveCacheOwner({ sessionUserId, isOffline }).then(() => {
      if (!cancelled) {
        setReadyOwner(activeCacheOwner());
      }
    });

    return () => {
      cancelled = true;
    };
  }, [sessionUserId, isOffline]);

  // Warm the Warm Set once per owner while Live. The Reconnect Sequence re-warms
  // on later reconnects (a subsequent commit); here we just guarantee an initial
  // warm so an Offline reload has content.
  const warmedOwners = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isLive || !readyOwner || warmedOwners.current.has(readyOwner)) {
      return;
    }

    warmedOwners.current.add(readyOwner);
    void warmCache({ trpc: trpc as unknown as WarmerTRPC, queryClient });
  }, [isLive, readyOwner, trpc, queryClient]);

  return <>{children}</>;
}
