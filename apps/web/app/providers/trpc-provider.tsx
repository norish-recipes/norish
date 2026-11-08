"use client";

import {
  isOfflineForced,
  OFFLINE_FORCED_AVAILABLE,
  subscribeOfflineForced,
} from "@/lib/connectivity/forced-offline";

import type { AppRouter } from "@norish/trpc/client";
import { createForcedOfflineLink } from "@norish/shared-react/offline";
import { createTRPCProviderBundle } from "@norish/shared-react/trpc";
import { addBasePath } from "@norish/shared/lib/base-path";
import { createClientLogger } from "@norish/shared/lib/logger";

const log = createClientLogger("trpc");

export const { TRPCProviderWrapper } = createTRPCProviderBundle({
  logger: log,
  // Dev only (ADR-0007): blocks the transport while Offline is forced, and holds subscriptions so
  // the lazy WebSocket (wsLazyEnabled, the default) never connects. Production gets no link.
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
