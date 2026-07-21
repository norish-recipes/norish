"use client";

import { createForcedOfflineLink, OFFLINE_FORCED_AVAILABLE } from "@/lib/connectivity";
import { createOutboxLink } from "@/lib/outbox";
import { getPersistedQueryClient } from "@/lib/query-cache";

import type { AppRouter } from "@norish/trpc/client";
import { createTRPCProviderBundle } from "@norish/shared-react/providers";
import { createClientLogger } from "@norish/shared/lib/logger";

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
    // Dev-only: a forced-Offline link sitting below the Outbox link and above
    // the real transport (ADR-0007). It blocks the transport when Offline is
    // forced so the offline runtime can be exercised without taking the backend
    // down. Stripped in production — OFFLINE_FORCED_AVAILABLE folds to false, so
    // extraLinks is an empty array and the dev link ships nothing.
    extraLinks: OFFLINE_FORCED_AVAILABLE ? [createForcedOfflineLink<AppRouter>()] : [],
    // Reconnect is handled by the explicit Reconnect Sequence (drain → refetch →
    // warm) in OfflineCacheController, not the bundle's blanket invalidation —
    // refetching before draining would make queued changes vanish and reappear.
    invalidateOnReconnect: false,
  });
