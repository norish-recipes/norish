import type { AppRouter } from '@norish/trpc/client';
import { createTRPCProviderBundle } from '@norish/shared-react/providers';
import { createClientLogger } from '@norish/shared/lib/logger';
import React, { useMemo } from 'react';

import { getAuthClient } from '@/lib/auth-client';

const log = createClientLogger('mobile-trpc');

function toWsUrl(baseUrl: string): string {
  const parsed = new URL(baseUrl);

  parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
  parsed.pathname = '/trpc';
  parsed.search = '';
  parsed.hash = '';

  return parsed.toString().replace(/\/+$/, '');
}

let currentBaseUrl = '';

function createMobileWebSocket(): typeof WebSocket | undefined {
  const NativeWebSocket = globalThis.WebSocket as any;

  if (!NativeWebSocket) {
    return undefined;
  }

  return class MobileWebSocketWithHeaders extends NativeWebSocket {
    constructor(url: string | URL, protocols?: string | string[]) {
      const headers = trpcBundleGetHeaders();

      super(url, protocols, { headers });
    }
  } as unknown as typeof WebSocket;
}

function trpcBundleGetHeaders() {
  if (!currentBaseUrl) {
    return {};
  }

  const client = getAuthClient(currentBaseUrl);
  const cookies = (client as any).getCookie?.() as string | undefined;

  if (!cookies) {
    return {};
  }

  return { Cookie: cookies };
}

const trpcBundle = createTRPCProviderBundle<AppRouter>({
  logger: log,
  getBaseUrl: () => currentBaseUrl,
  getWsUrl: () => toWsUrl(currentBaseUrl),
  getHeaders: trpcBundleGetHeaders,
  getWebSocketImpl: createMobileWebSocket,
  enableLoggerLink: false,
});

export const useTRPC = trpcBundle.useTRPC;
export const useConnectionStatus = trpcBundle.useConnectionStatus;

export function TrpcProvider({
  baseUrl,
  children,
}: {
  baseUrl: string;
  children: React.ReactNode;
}) {
  const providerKey = useMemo(() => baseUrl, [baseUrl]);

  currentBaseUrl = baseUrl;

  return (
    <trpcBundle.TRPCProviderWrapper key={providerKey}>
      {children}
    </trpcBundle.TRPCProviderWrapper>
  );
}
