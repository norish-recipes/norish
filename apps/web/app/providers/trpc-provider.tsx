"use client";

import type { AppRouter } from "@norish/trpc/client";
import { createTRPCProviderBundle } from "@norish/shared-react/providers";
import { createClientLogger } from "@norish/shared/lib/logger";

import { getPersistedQueryClient } from "@/lib/query-cache";

const log = createClientLogger("trpc");

export const { TRPCProvider, TRPCProviderWrapper, useConnectionStatus, useTRPC } =
  createTRPCProviderBundle<AppRouter>({
    logger: log,
    // Persist the query cache to IndexedDB via the shared bundle's seam so the
    // web app serves cached reads while Offline (ADR-0001). The Warmer and
    // per-user scoping are driven by OfflineCacheController.
    getQueryClient: getPersistedQueryClient,
  });
