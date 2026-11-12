"use client";

import type { TRPCClient, TRPCLink } from "@trpc/client";
import type { ReactNode } from "react";
import { createContext, use, useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";

import type { AppRouter } from "@norish/trpc/client";

import type { CreateTRPCProviderBundleOptions } from "./trpc-links";
import {
  createTRPCClientLinks,
  defaultGetBaseUrl,
  defaultGetHeaders,
  defaultGetWsUrl,
  isNormalWebSocketClose,
} from "./trpc-links";

/**
 * What the socket is doing. `idle` is a socket that closed normally or was
 * never opened (it is lazy); `disconnected` is one that closed for another
 * reason and is reconnecting. Recovery owns what happens on reconnect
 * (ADR-0011); the provider only reports.
 */
export type ConnectionStatus = "idle" | "connected" | "disconnected";

type ConnectionContextValue = {
  status: ConnectionStatus;
  isConnected: boolean;
};

// One context per app: every hook imports useTRPC, and the app's provider bundle fills it.
const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();
const ConnectionContext = createContext<ConnectionContextValue>({
  status: "idle",
  isConnected: false,
});
const TRPCClientContext = createContext<TRPCClient<AppRouter> | null>(null);

export { useTRPC };

export function useConnectionStatus() {
  return use(ConnectionContext);
}

export function useTRPCClient(): TRPCClient<AppRouter> {
  const client = use(TRPCClientContext);

  if (!client) {
    throw new Error("useTRPCClient must be used within TRPCProviderWrapper");
  }

  return client;
}

/** An app's transport for the one context: links, WebSocket implementation and callbacks. */
export function createTRPCProviderBundle({
  logger,
  getBaseUrl = defaultGetBaseUrl,
  getWsUrl = defaultGetWsUrl,
  getHeaders = defaultGetHeaders,
  getWebSocketImpl,
  wsLazyEnabled = true,
  wsLazyCloseMs = 0,
  retryRandom,
  enableLoggerLink = true,
  onWebSocketClose,
  onWebSocketOpen,
  onWebSocketUnauthorized,
  onWebSocketClientCreate,
  onUnauthorized,
  extraLinks = [],
}: Omit<CreateTRPCProviderBundleOptions<AppRouter>, "mutationLink">) {
  /** The client's offline engine supplies `getQueryClient` and `mutationLink`; both are read once. */
  function TRPCProviderWrapper({
    children,
    getQueryClient: externalGetQueryClient,
    mutationLink,
  }: {
    children: ReactNode;
    getQueryClient?: () => QueryClient;
    mutationLink?: TRPCLink<AppRouter>;
  }) {
    "use memo";

    const [status, setStatus] = useState<ConnectionStatus>("idle");
    const [{ queryClient, trpcClient, revive, retire }] = useState(() => {
      // The links' WebSocket client, closed when the provider unmounts.
      let webSocketClient: { close: () => Promise<void> } | null = null;
      // Unmounted, this client's session is not the reader's now, so its 401 and 4401 say nothing.
      let retired = false;
      const qc = externalGetQueryClient
        ? externalGetQueryClient()
        : new QueryClient({
            defaultOptions: {
              queries: {
                staleTime: 1000 * 60 * 5,
                gcTime: 1000 * 60 * 10,
                refetchOnWindowFocus: true,
                refetchOnMount: "always",
                retry: 1,
              },
            },
          });

      const tc = createTRPCClient<AppRouter>({
        links: createTRPCClientLinks<AppRouter>({
          logger,
          getBaseUrl,
          getWsUrl,
          getHeaders,
          getWebSocketImpl,
          wsLazyEnabled,
          wsLazyCloseMs,
          retryRandom,
          enableLoggerLink,
          onWebSocketClientCreate: (client) => {
            webSocketClient = client;
            onWebSocketClientCreate?.(client);
          },
          onWebSocketOpen: () => {
            setStatus("connected");
            onWebSocketOpen?.();
          },
          onWebSocketClose: (cause) => {
            // Every close reaches the app; only the status differs.
            setStatus(isNormalWebSocketClose(cause) ? "idle" : "disconnected");
            onWebSocketClose?.(cause);
          },
          onWebSocketUnauthorized: (cause) => {
            if (!retired) onWebSocketUnauthorized?.(cause);
          },
          onUnauthorized: (cause) => {
            if (!retired) onUnauthorized?.(cause);
          },
          mutationLink,
          extraLinks,
        }),
      });

      const retire = () => {
        const client = webSocketClient;

        retired = true;
        webSocketClient = null;

        if (!client) {
          return;
        }

        void client.close().catch(() => null);
      };

      // StrictMode's remount runs the cleanup once without the client being replaced.
      const revive = () => {
        retired = false;
      };

      return { queryClient: qc, trpcClient: tc, revive, retire };
    });

    useEffect(() => {
      revive();

      return retire;
    }, [revive, retire]);

    const connectionValue: ConnectionContextValue = {
      status,
      isConnected: status === "connected",
    };

    return (
      <ConnectionContext value={connectionValue}>
        <TRPCClientContext value={trpcClient}>
          <QueryClientProvider client={queryClient}>
            <TRPCProvider queryClient={queryClient} trpcClient={trpcClient}>
              {children}
            </TRPCProvider>
          </QueryClientProvider>
        </TRPCClientContext>
      </ConnectionContext>
    );
  }

  return { TRPCProviderWrapper };
}
