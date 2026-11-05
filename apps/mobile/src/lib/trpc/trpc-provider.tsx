import React, { useMemo, useSyncExternalStore } from "react";
import {
  getAuthTransportSnapshot,
  invalidateSession,
  subscribeAuthTransport,
} from "@/lib/auth/auth-session-sync";
import { AUTH_COOKIE_KEY, authStorage } from "@/lib/auth/auth-storage";
import { getBackendWsUrl } from "@/lib/network/backend-ws-url";
import { getServerAddress, offlineEngine, setServerAddress } from "@/lib/offline/engine";
import { getCookie } from "@better-auth/expo/client";

import type { AppRouter } from "@norish/trpc/client";
import { createTRPCProviderBundle } from "@norish/shared-react/providers";
import { createClientLogger } from "@norish/shared/lib/logger";

const log = createClientLogger("mobile-trpc");

type ManagedWebSocketClient = {
  close: () => Promise<void>;
};

const mobileWebSocketClients = new Set<ManagedWebSocketClient>();

export async function closeMobileTrpcConnections(): Promise<void> {
  const clients = Array.from(mobileWebSocketClients);

  await Promise.all(clients.map(async (client) => client.close().catch(() => null)));
}

type HeaderCapableWebSocket = typeof WebSocket & {
  new (
    url: string | URL,
    protocols?: string | string[],
    options?: { headers: Record<string, string> }
  ): WebSocket;
};

function createMobileWebSocket(): typeof WebSocket | undefined {
  const NativeWebSocket = globalThis.WebSocket as HeaderCapableWebSocket | undefined;

  if (!NativeWebSocket) {
    return undefined;
  }

  return class MobileWebSocketWithHeaders extends NativeWebSocket {
    constructor(url: string | URL, protocols?: string | string[]) {
      const headers = trpcBundleGetHeaders();

      if (Object.keys(headers).length === 0) {
        super(url, protocols);

        return;
      }

      try {
        super(url, protocols, { headers });
      } catch {
        super(url, protocols);
      }
    }
  } as unknown as typeof WebSocket;
}

// The auth client's getCookie is async and tRPC asks for headers synchronously, so read the
// chunked SecureStore entry the auth client writes directly.
function trpcBundleGetHeaders(): Record<string, string> {
  if (!getServerAddress()) {
    return {};
  }

  const cookies = getCookie(authStorage.getItem(AUTH_COOKIE_KEY));

  return cookies ? { Cookie: cookies } : {};
}

const trpcBundle = createTRPCProviderBundle<AppRouter>({
  logger: log,
  getBaseUrl: getServerAddress,
  getWsUrl: () => getBackendWsUrl(getServerAddress()),
  getHeaders: trpcBundleGetHeaders,
  getWebSocketImpl: createMobileWebSocket,
  wsLazyEnabled: true,
  enableLoggerLink: false,
  getQueryClient: () => offlineEngine.queryClient,
  onWebSocketClientCreate: (client) => {
    mobileWebSocketClients.add(client);
  },
  onWebSocketUnauthorized: () => {
    log.info("WebSocket rejected with unauthorized response, signing out");
    void invalidateSession("websocket-unauthorized");
  },
  onUnauthorized: () => {
    log.info("tRPC request returned unauthorized response, signing out");
    void invalidateSession("transport-unauthorized");
  },
  mutationLink: offlineEngine.outboxLink,
});

export const useTRPC = trpcBundle.useTRPC;
export const useConnectionStatus = trpcBundle.useConnectionStatus;
export const useTRPCClient = trpcBundle.useTRPCClient;

export function TrpcProvider({
  baseUrl,
  children,
}: {
  baseUrl: string;
  children: React.ReactNode;
}) {
  const authTransportSnapshot = useSyncExternalStore(
    subscribeAuthTransport,
    getAuthTransportSnapshot,
    getAuthTransportSnapshot
  );
  const providerKey = useMemo(
    () => `${baseUrl}:${authTransportSnapshot.version}`,
    [authTransportSnapshot.version, baseUrl]
  );

  setServerAddress(baseUrl);

  return (
    <trpcBundle.TRPCProviderWrapper key={providerKey}>{children}</trpcBundle.TRPCProviderWrapper>
  );
}
