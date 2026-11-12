"use client";

import {
  isOfflineForced,
  OFFLINE_FORCED_AVAILABLE,
  subscribeOfflineForced,
} from "@/lib/connectivity/forced-offline";
import { offlineEngine } from "@/lib/offline/engine";

import type { AppRouter } from "@norish/trpc/client";
import { createForcedOfflineLink } from "@norish/shared-react/offline";
import { createTRPCProviderBundle } from "@norish/shared-react/trpc";
import { addBasePath } from "@norish/shared/lib/base-path";
import { createClientLogger } from "@norish/shared/lib/logger";

const log = createClientLogger("trpc");

let expiring = false;

/** Session Expiry (CONTEXT.md): forget the Offline Cache, keep the Outbox, sign in, come back. */
function expireSession(): void {
  if (typeof window === "undefined" || expiring) return;
  expiring = true;

  void offlineEngine
    .clearForSignOut({ discardQueue: false })
    .catch((error: unknown) => log.error({ error }, "Failed to clear offline data on expiry"))
    .finally(() => {
      const loginUrl = new URL(addBasePath("/login"), window.location.origin);

      loginUrl.searchParams.set("callbackUrl", window.location.pathname + window.location.search);
      window.location.assign(loginUrl.toString());
    });
}

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
