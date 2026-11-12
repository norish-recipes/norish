import type { QueryClient } from "@tanstack/react-query";
import type { TRPCLink } from "@trpc/client";
import React, { useMemo, useSyncExternalStore } from "react";
import { getAuthTransportSnapshot, subscribeAuthTransport } from "@/lib/auth/auth-session-sync";
import { AUTH_COOKIE_KEY, authStorage } from "@/lib/auth/auth-storage";
import { getBackendBaseUrl } from "@/lib/network/backend-base-url";
import { getBackendWsUrl } from "@/lib/network/backend-ws-url";
import { getCookie } from "@better-auth/expo/client";

import type { AppRouter } from "@norish/trpc/client";
import { expireSession } from "@norish/shared-react/reader";
import { createTRPCProviderBundle } from "@norish/shared-react/trpc";
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
  if (!getBackendBaseUrl()) {
    return {};
  }

  const cookies = getCookie(authStorage.getItem(AUTH_COOKIE_KEY));

  return cookies ? { Cookie: cookies } : {};
}

const { TRPCProviderWrapper } = createTRPCProviderBundle({
  logger: log,
  getBaseUrl: getBackendBaseUrl,
  getWsUrl: () => getBackendWsUrl(getBackendBaseUrl()),
  getHeaders: trpcBundleGetHeaders,
  getWebSocketImpl: createMobileWebSocket,
  wsLazyEnabled: true,
  enableLoggerLink: false,
  onWebSocketClientCreate: (client) => {
    mobileWebSocketClients.add(client);
  },
  // The server closed the socket with 4401, or a request was answered 401: Session Expiry.
  onWebSocketUnauthorized: expireSession,
  onUnauthorized: expireSession,
});

/** `getQueryClient` and `mutationLink` come from the offline engine; both are read once. */
export function TrpcProvider({
  baseUrl,
  children,
  getQueryClient,
  mutationLink,
}: {
  baseUrl: string;
  children: React.ReactNode;
  getQueryClient: () => QueryClient;
  mutationLink: TRPCLink<AppRouter>;
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

  return (
    <TRPCProviderWrapper
      key={providerKey}
      getQueryClient={getQueryClient}
      mutationLink={mutationLink}
    >
      {children}
    </TRPCProviderWrapper>
  );
}
