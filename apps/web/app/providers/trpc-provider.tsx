"use client";

import {
  createWebQueryClient,
  webConnectivityRuntime,
  webSocketConnectivity,
  webTransportFetch,
} from "@/lib/connectivity";
import { getWebOutboxCaptureUserId, getWebOutboxReplayUserId } from "@/lib/offline-delivery-user";

import type { AppRouter } from "@norish/trpc/client";
import { createTRPCProviderBundle } from "@norish/shared-react/providers";
import { createClientLogger } from "@norish/shared/lib/logger";

const log = createClientLogger("trpc");

export const { TRPCProvider, TRPCProviderWrapper, useConnectionStatus, useTRPC } =
  createTRPCProviderBundle<AppRouter>({
    logger: log,
    getQueryClient: createWebQueryClient,
    getWsUrl: webSocketConnectivity.getUrl,
    getWebSocketImpl: webSocketConnectivity.getWebSocketImpl,
    transportFetch: webTransportFetch,
    // HTTP recovery owns replay-before-refetch ordering for this web provider.
    invalidateOnReconnect: false,
    webOutbox: {
      getCaptureUserId: getWebOutboxCaptureUserId,
      getReplayUserId: getWebOutboxReplayUserId,
      getBackendOrigin: () =>
        typeof window === "undefined" ? "" : new URL("", window.location.href).origin,
      recovery: webConnectivityRuntime.recovery,
      // Next.js statically replaces explicitly referenced NEXT_PUBLIC values.
      // eslint-disable-next-line no-restricted-properties
      enabled: () => process.env.NEXT_PUBLIC_WEB_OUTBOX_ENABLED !== "false",
    },
  });
