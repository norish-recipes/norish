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
    //
    // Forced-Offline's WebSocket silence relies on the WS staying lazy (the
    // bundle default, wsLazyEnabled=true): the dev link holds subscriptions
    // pending, so the lazy socket is never asked to connect, and forwards them
    // to the transport when the override clears (the socket then connects
    // organically). Do not pass wsLazyEnabled:false here without revisiting
    // forced-Offline (an eager socket would connect despite the dev link).
    extraLinks: OFFLINE_FORCED_AVAILABLE ? [createForcedOfflineLink<AppRouter>()] : [],
    // The server closed the socket with 4401: the session is gone, and no
    // reconnect will bring it back. Sign in again, then come back here.
    onWebSocketUnauthorized: () => {
      if (typeof window === "undefined") return;

      const loginUrl = new URL("/login", window.location.origin);

      loginUrl.searchParams.set("callbackUrl", window.location.pathname + window.location.search);
      window.location.assign(loginUrl.toString());
    },
  });
