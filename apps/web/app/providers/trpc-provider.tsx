"use client";

import {
  isOfflineForced,
  OFFLINE_FORCED_AVAILABLE,
  subscribeOfflineForced,
} from "@/lib/connectivity/forced-offline";

import type { AppRouter } from "@norish/trpc/client";
import { createForcedOfflineLink } from "@norish/shared-react/offline";
import { expireSession } from "@norish/shared-react/reader";
import { createTRPCProviderBundle } from "@norish/shared-react/trpc";
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
  // The server closed the socket with 4401, or a request was answered 401: no retry brings it back.
  onWebSocketUnauthorized: expireSession,
  onUnauthorized: expireSession,
});
