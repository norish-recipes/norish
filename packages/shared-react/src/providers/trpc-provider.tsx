"use client";

import type { TRPCClient } from "@trpc/client";
import type { AnyTRPCRouter } from "@trpc/server";
import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";

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

export function createTRPCProviderBundle<TRouter extends AnyTRPCRouter>({
  logger,
  getBaseUrl = defaultGetBaseUrl,
  getWsUrl = defaultGetWsUrl,
  getHeaders = defaultGetHeaders,
  getWebSocketImpl,
  wsLazyEnabled = true,
  wsLazyCloseMs = 0,
  retryRandom,
  enableLoggerLink = true,
  getQueryClient: externalGetQueryClient,
  onWebSocketClose,
  onWebSocketOpen,
  onWebSocketUnauthorized,
  onWebSocketClientCreate,
  onUnauthorized,
  mutationLink,
  extraLinks = [],
}: CreateTRPCProviderBundleOptions<TRouter>) {
  const { TRPCProvider, useTRPC } = createTRPCContext<TRouter>();
  const ConnectionContext = createContext<ConnectionContextValue>({
    status: "idle",
    isConnected: false,
  });
  const TRPCClientContext = createContext<TRPCClient<TRouter> | null>(null);

  function useConnectionStatus() {
    return useContext(ConnectionContext);
  }

  function useTRPCClient(): TRPCClient<TRouter> {
    const client = useContext(TRPCClientContext);

    if (!client) {
      throw new Error("useTRPCClient must be used within TRPCProviderWrapper");
    }

    return client;
  }

  function TRPCProviderWrapper({ children }: { children: ReactNode }) {
    const [status, setStatus] = useState<ConnectionStatus>("idle");
    const webSocketClientRef = useRef<{ close: () => Promise<void> } | null>(null);

    const [{ queryClient, trpcClient }] = useState(() => {
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

      const tc = createTRPCClient<TRouter>({
        links: createTRPCClientLinks<TRouter>({
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
            webSocketClientRef.current = client;
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
          onWebSocketUnauthorized,
          onUnauthorized,
          mutationLink,
          extraLinks,
        }),
      });

      return { queryClient: qc, trpcClient: tc };
    });

    useEffect(() => {
      return () => {
        const client = webSocketClientRef.current;

        webSocketClientRef.current = null;

        if (!client) {
          return;
        }

        void client.close().catch(() => null);
      };
    }, []);

    const connectionValue: ConnectionContextValue = {
      status,
      isConnected: status === "connected",
    };

    return (
      <ConnectionContext.Provider value={connectionValue}>
        <TRPCClientContext.Provider value={trpcClient}>
          <QueryClientProvider client={queryClient}>
            <TRPCProvider queryClient={queryClient} trpcClient={trpcClient}>
              {children}
            </TRPCProvider>
          </QueryClientProvider>
        </TRPCClientContext.Provider>
      </ConnectionContext.Provider>
    );
  }

  return {
    TRPCProvider,
    TRPCProviderWrapper,
    useTRPC,
    useTRPCClient,
    useConnectionStatus,
  };
}
