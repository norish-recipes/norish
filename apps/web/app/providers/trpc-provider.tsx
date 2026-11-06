"use client";

import {
  isOfflineForced,
  OFFLINE_FORCED_AVAILABLE,
  subscribeOfflineForced,
} from "@/lib/connectivity/forced-offline";

import type { AppRouter } from "@norish/trpc/client";
import { createForcedOfflineLink } from "@norish/shared-react/offline";
import { createTRPCProviderBundle } from "@norish/shared-react/providers";
import { addBasePath } from "@norish/shared/lib/base-path";
import { createClientLogger } from "@norish/shared/lib/logger";

const log = createClientLogger("trpc");

export const { TRPCProvider, TRPCProviderWrapper, useConnectionStatus, useTRPC, useTRPCClient } =
  createTRPCProviderBundle<AppRouter>({
    logger: log,
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
    extraLinks: OFFLINE_FORCED_AVAILABLE
      ? [
          createForcedOfflineLink<AppRouter>({
            isForced: isOfflineForced,
            subscribe: subscribeOfflineForced,
          }),
        ]
      : [],
    // The server closed the socket with 4401: the session is gone, and no
    // reconnect will bring it back. Sign in again, then come back here.
    onWebSocketUnauthorized: () => {
      if (typeof window === "undefined") return;

      const loginUrl = new URL(addBasePath("/login"), window.location.origin);

      loginUrl.searchParams.set("callbackUrl", window.location.pathname + window.location.search);
      window.location.assign(loginUrl.toString());
    },
  });
