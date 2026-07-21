"use client";

import type { AppRouter } from "@norish/trpc/client";
import { createTRPCProviderBundle } from "@norish/shared-react/providers";
import { createClientLogger } from "@norish/shared/lib/logger";

import { createOutboxLink } from "@/lib/outbox";
import { getPersistedQueryClient } from "@/lib/query-cache";

const log = createClientLogger("trpc");

export const { TRPCProvider, TRPCProviderWrapper, useConnectionStatus, useTRPC, useTRPCClient } =
  createTRPCProviderBundle<AppRouter>({
    logger: log,
    // Persist the query cache to IndexedDB via the shared bundle's seam so the
    // web app serves cached reads while Offline (ADR-0001). The Warmer and
    // per-user scoping are driven by OfflineCacheController.
    getQueryClient: getPersistedQueryClient,
    // A mutation that fails on unreachability is captured into the IndexedDB
    // Outbox for later Replay (ADR-0001 writes side).
    mutationLink: createOutboxLink<AppRouter>(),
    // Reconnect is handled by the explicit Reconnect Sequence (drain → refetch →
    // warm) in OfflineCacheController, not the bundle's blanket invalidation —
    // refetching before draining would make queued changes vanish and reappear.
    invalidateOnReconnect: false,
  });
