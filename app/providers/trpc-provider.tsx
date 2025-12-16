"use client";

import type { AppRouter } from "@/server/trpc";

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
import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from "react";
import superjson from "superjson";

import { createClientLogger } from "@/lib/logger";

const log = createClientLogger("trpc");

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

type ConnectionContextValue = {
  status: ConnectionStatus;
  isConnected: boolean;
};

const ConnectionContext = createContext<ConnectionContextValue>({
  status: "connecting",
  isConnected: false,
});

export function useConnectionStatus() {
  return useContext(ConnectionContext);
}

function getBaseUrl() {
  if (typeof window !== "undefined") return "";

  return `http://localhost:${process.env.PORT ?? 3000}`;
}

function getWsUrl() {
  if (typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";

    return `${protocol}//${window.location.host}/trpc`;
  }

  return `ws://localhost:${process.env.PORT ?? 3000}/trpc`;
}

export function TRPCProviderWrapper({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const previousStatusRef = useRef<ConnectionStatus>("connecting");
  const queryClientRef = useRef<QueryClient | null>(null);

  // Create clients once
  const [{ queryClient, trpcClient }] = useState(() => {
    const qc = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 1000 * 60 * 5, // 5 minutes
          gcTime: 1000 * 60 * 10, // 10 minutes
          refetchOnWindowFocus: true, // Refresh when user returns to tab
          refetchOnMount: "always", // Always refetch on mount, even if not stale
          retry: 1,
        },
      },
    });

    queryClientRef.current = qc;

    const MAX_RETRIES = 10;

    const wsClient = createWSClient({
      url: getWsUrl,
      retryDelayMs: (attemptIndex) => {
        // Stop retrying after MAX_RETRIES failures
        if (attemptIndex >= MAX_RETRIES) {
          log.warn({ attemptIndex }, "Max WebSocket retries reached, giving up");
          return Infinity; // Effectively stop retrying
        }
        // Exponential backoff: 1s, 2s, 4s, 8s, 16s, max 30s
        const delay = Math.min(1000 * Math.pow(2, attemptIndex), 30000);
        log.debug({ attemptIndex, delay }, "WebSocket reconnecting");
        return delay;
      },
      onOpen: () => {
        log.info("WebSocket connected");
        setStatus("connected");
      },
      onClose: (cause) => {
        log.info({ cause }, "WebSocket closed");
        setStatus("disconnected");
      },
    });

    const tc = createTRPCClient<AppRouter>({
      links: [
        loggerLink({
          enabled: (opts) =>
            process.env.NODE_ENV === "development" ||
            (opts.direction === "down" && opts.result instanceof Error),
        }),
        splitLink({
          condition: (op) => op.type === "subscription",
          true: wsLink({ client: wsClient, transformer: superjson }),
          // Split non-subscription requests: FormData uses httpLink, others use httpBatchLink
          false: splitLink({
            condition: (op) => isNonJsonSerializable(op.input),
            // FormData/File uploads - use httpLink (no batching)
            true: httpLink({
              url: `${getBaseUrl()}/api/trpc`,
              transformer: {
                // Request: don't transform FormData
                serialize: (data) => data,
                // Response: use superjson for deserialization
                deserialize: superjson.deserialize,
              },
            }),
            // Regular JSON requests - use batched link
            false: httpBatchLink({ url: `${getBaseUrl()}/api/trpc`, transformer: superjson }),
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
      log.info("Connection restored, invalidating queries");
      queryClientRef.current.invalidateQueries();
    }
  }, [status]);

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
