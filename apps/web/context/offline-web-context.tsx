"use client";

import type { OfflineWebContextValue } from "@/context/offline-web/shared";
import type { WebConnectivityRuntime } from "@/lib/connectivity";
import type { WebReadCacheRepository } from "@/lib/offline-read-cache";
import type { ReactNode } from "react";
import { createContext, useContext, useMemo } from "react";
import { useTRPC } from "@/app/providers/trpc-provider";
import { FALLBACK_DEADLINE_MS } from "@/context/offline-web/shared";
import { useOfflineWebController } from "@/context/offline-web/use-offline-web-controller";
import { webConnectivityRuntime } from "@/lib/connectivity";
import { WebReadCacheRepository as DefaultWebReadCacheRepository } from "@/lib/offline-read-cache";
import { createOfflineReadCacheRegistry } from "@/lib/offline-read-cache/query-registry";
import { useQueryClient } from "@tanstack/react-query";

import type { User } from "@norish/shared/contracts";
import { useSession } from "@norish/shared/lib/auth/client";

export type { OfflineWebPhase } from "@/context/offline-web/shared";

const OfflineWebContext = createContext<OfflineWebContextValue | null>(null);
const repository = new DefaultWebReadCacheRepository();

export type OfflineWebProviderProps = {
  children: ReactNode;
  cacheRepository?: WebReadCacheRepository;
  connectivityRuntime?: WebConnectivityRuntime;
  fallbackDeadlineMs?: number;
};

export function OfflineWebProvider({
  children,
  cacheRepository = repository,
  connectivityRuntime = webConnectivityRuntime,
  fallbackDeadlineMs = FALLBACK_DEADLINE_MS,
}: OfflineWebProviderProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const session = useSession();
  const registry = useMemo(() => createOfflineReadCacheRegistry(trpc), [trpc]);
  const value = useOfflineWebController({
    cacheRepository,
    connectivityRuntime,
    fallbackDeadlineMs,
    queryClient,
    registry,
    session,
  });

  return <OfflineWebContext.Provider value={value}>{children}</OfflineWebContext.Provider>;
}

export function useOfflineWeb(): OfflineWebContextValue {
  const context = useContext(OfflineWebContext);

  if (!context) throw new Error("useOfflineWeb must be used within OfflineWebProvider");

  return context;
}

export function useOfflineRenderUser(): {
  user: User | null;
  isRenderOnly: boolean;
} {
  const { renderUser, renderIdentityOnly } = useOfflineWeb();

  return { user: renderUser, isRenderOnly: renderIdentityOnly };
}
