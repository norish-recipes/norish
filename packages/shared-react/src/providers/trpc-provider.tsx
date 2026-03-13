"use client";

import type { HTTPHeaders } from "@trpc/client";
import type { AnyTRPCRouter } from "@trpc/server";
import type { ReactNode } from "react";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createTRPCClient,
  createWSClient,
  httpBatchLink,
  httpLink,
  isNonJsonSerializable,
  loggerLink,
  splitLink,
  wsLink,
} from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import superjson from "superjson";

type TrpcLogger = {
  info: (message: string) => void;
  warn: (meta: unknown, message: string) => void;
  debug: (meta: unknown, message: string) => void;
};

export type ConnectionStatus = "idle" | "connecting" | "connected" | "disconnected";

type ConnectionContextValue = {
  status: ConnectionStatus;
  isConnected: boolean;
};

type CreateTRPCProviderBundleOptions = {
  logger: TrpcLogger;
  getBaseUrl?: () => string;
  getWsUrl?: () => string;
  getHeaders?: () => HTTPHeaders;
  getWebSocketImpl?: () => typeof WebSocket | undefined;
  maxRetries?: number;
  /** Set to false to disable tRPC loggerLink (defaults to true) */
  enableLoggerLink?: boolean;
};

const defaultGetBaseUrl = () => {
  if (typeof window !== "undefined") {
    return "";
  }

  return `http://localhost:${process.env.PORT ?? 3000}`;
};

const defaultGetWsUrl = () => {
  if (typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";

    return `${protocol}//${window.location.host}/trpc`;
  }

  return `ws://localhost:${process.env.PORT ?? 3000}/trpc`;
};

const defaultGetHeaders = (): HTTPHeaders => ({});

export function createTRPCProviderBundle<TRouter extends AnyTRPCRouter>({
  logger,
  getBaseUrl = defaultGetBaseUrl,
  getWsUrl = defaultGetWsUrl,
  getHeaders = defaultGetHeaders,
  getWebSocketImpl,
  maxRetries = 10,
  enableLoggerLink = true,
}: CreateTRPCProviderBundleOptions) {
  const { TRPCProvider, useTRPC } = createTRPCContext<TRouter>();
  const ConnectionContext = createContext<ConnectionContextValue>({
    status: "idle",
    isConnected: false,
  });

  function useConnectionStatus() {
    return useContext(ConnectionContext);
  }

  function TRPCProviderWrapper({ children }: { children: ReactNode }) {
    const [status, setStatus] = useState<ConnectionStatus>("idle");
    const previousStatusRef = useRef<ConnectionStatus>("idle");
    const queryClientRef = useRef<QueryClient | null>(null);

    const [{ queryClient, trpcClient }] = useState(() => {
      const qc = new QueryClient({
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

      queryClientRef.current = qc;

      const wsClient = createWSClient({
        url: getWsUrl,
        WebSocket: getWebSocketImpl?.(),
        lazy: {
          enabled: true,
          closeMs: 0,
        },
        retryDelayMs: (attemptIndex) => {
          if (attemptIndex >= maxRetries) {
            logger.warn({ attemptIndex }, "Max WebSocket retries reached, giving up");

            return Infinity;
          }

          const delay = Math.min(1000 * Math.pow(2, attemptIndex), 30000);

          logger.debug({ attemptIndex, delay }, "WebSocket reconnecting");

          return delay;
        },
        onOpen: () => {
          logger.info("WebSocket connected");
          setStatus("connected");
        },
        onClose: (cause) => {
          logger.info(`WebSocket closed: ${JSON.stringify(cause)}`);
          setStatus("disconnected");
        },
      });

      const tc = createTRPCClient<TRouter>({
        links: [
          ...(enableLoggerLink
            ? [
                loggerLink({
                  enabled: (opts) =>
                    process.env.NODE_ENV === "development" ||
                    (opts.direction === "down" && opts.result instanceof Error),
                }),
              ]
            : []),
          splitLink({
            condition: (op) => op.type === "subscription",
            true: wsLink({ client: wsClient, transformer: superjson as any }),
            false: splitLink({
              condition: (op) => isNonJsonSerializable(op.input),
              true: httpLink({
                url: `${getBaseUrl()}/api/trpc`,
                headers: getHeaders,
                transformer: {
                  serialize: (data: unknown) => data,
                  deserialize: superjson.deserialize,
                } as any,
              }),
              false: httpBatchLink({
                url: `${getBaseUrl()}/api/trpc`,
                headers: getHeaders,
                transformer: superjson as any,
              }),
            }),
          }),
        ],
      });

      return { queryClient: qc, trpcClient: tc };
    });

    useEffect(() => {
      const wasDisconnected = previousStatusRef.current !== "connected";

      previousStatusRef.current = status;

      if (status === "connected" && wasDisconnected && queryClientRef.current) {
        logger.info("Connection restored, invalidating queries");
        queryClientRef.current.invalidateQueries();
      }
    }, [logger, status]);

    const connectionValue: ConnectionContextValue = {
      status,
      isConnected: status === "connected",
    };

    return (
      <ConnectionContext.Provider value={connectionValue}>
        <QueryClientProvider client={queryClient}>
          <TRPCProvider queryClient={queryClient} trpcClient={trpcClient}>
            {children}
          </TRPCProvider>
        </QueryClientProvider>
      </ConnectionContext.Provider>
    );
  }

  return {
    TRPCProvider,
    TRPCProviderWrapper,
    useTRPC,
    useConnectionStatus,
  };
}
