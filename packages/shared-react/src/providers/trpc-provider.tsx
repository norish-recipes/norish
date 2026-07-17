"use client";

import type { AnyTRPCRouter } from "@trpc/server";
import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";

import { unwrapPayload } from "@norish/shared/lib/operation-helpers";

import type { CreateTRPCProviderBundleOptions } from "./trpc-links";
import {
  createWebOutboxLink,
  replayWebOutboxEntry,
  subscribeToWebOutboxChanges,
  WebOutboxReplayCoordinator,
  WebOutboxRepository,
} from "../outbox";
import {
  createTRPCClientLinks,
  defaultGetBaseUrl,
  defaultGetHeaders,
  defaultGetWsUrl,
  isNormalWebSocketClose,
} from "./trpc-links";

export type ConnectionStatus = "idle" | "connecting" | "connected" | "disconnected";

type ConnectionContextValue = {
  status: ConnectionStatus;
  isConnected: boolean;
};

type TRPCClientContextValue = object | null;

type SubscriptionObserverOptions = {
  onData?: (data: unknown) => void;
};

export type WebOutboxProviderOptions = {
  getCaptureUserId: () => Promise<string | null>;
  getReplayUserId: () => Promise<string | null>;
  getBackendOrigin: () => string;
  enabled?: () => boolean;
};

function withPayloadCompatibility(data: unknown): unknown {
  const payload = unwrapPayload(data);

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return payload;
  }

  const prototype = Object.getPrototypeOf(payload);

  if (prototype !== Object.prototype && prototype !== null) {
    return payload;
  }

  if ("payload" in payload) {
    return payload;
  }

  return {
    ...(payload as Record<string, unknown>),
    payload,
  };
}

export function wrapSubscriptionObserverOptions(options: unknown): unknown {
  if (!options || typeof options !== "object") {
    return options;
  }

  const observerOptions = options as SubscriptionObserverOptions;

  if (typeof observerOptions.onData !== "function") {
    return options;
  }

  return {
    ...observerOptions,
    onData: (data: unknown) => observerOptions.onData?.(withPayloadCompatibility(data)),
  };
}

export function wrapTrpcProxy<T>(value: T, cache: WeakMap<object, unknown>): T {
  if ((typeof value !== "object" && typeof value !== "function") || value === null) {
    return value;
  }

  const cached = cache.get(value as object);

  if (cached) {
    return cached as T;
  }

  const proxy = new Proxy(value as object, {
    get(target, prop, receiver) {
      const result = Reflect.get(target, prop, receiver);

      if (prop === "subscriptionOptions" && typeof result === "function") {
        return (...args: unknown[]) => {
          if (args.length === 0) {
            return Reflect.apply(result, target, args);
          }

          const wrappedArgs = [...args];
          const lastArgIndex = wrappedArgs.length - 1;

          wrappedArgs[lastArgIndex] = wrapSubscriptionObserverOptions(wrappedArgs[lastArgIndex]);

          return Reflect.apply(result, target, wrappedArgs);
        };
      }

      return wrapTrpcProxy(result, cache);
    },
  });

  cache.set(value as object, proxy);

  return proxy as T;
}

function createNormalizedUseTRPC<TTrpc>(useRawTRPC: () => TTrpc) {
  return function useNormalizedTRPC() {
    const trpc = useRawTRPC();

    return useMemo(() => wrapTrpcProxy(trpc, new WeakMap()), [trpc]);
  };
}

export function createTRPCProviderBundle<TRouter extends AnyTRPCRouter>({
  logger,
  getBaseUrl = defaultGetBaseUrl,
  getWsUrl = defaultGetWsUrl,
  getHeaders = defaultGetHeaders,
  transportFetch,
  getWebSocketImpl,
  wsLazyEnabled = true,
  getWsLazyEnabled,
  wsLazyCloseMs = 0,
  enableLoggerLink = true,
  getQueryClient: externalGetQueryClient,
  onWebSocketClose,
  onWebSocketOpen,
  onWebSocketUnauthorized,
  onWebSocketClientCreate,
  onWebSocketClientDestroy,
  onUnauthorized,
  mutationLink,
  extraLinks = [],
  invalidateOnReconnect = true,
  webOutbox,
}: CreateTRPCProviderBundleOptions & { webOutbox?: WebOutboxProviderOptions }) {
  const { TRPCProvider, useTRPC: useRawTRPC } = createTRPCContext<TRouter>();
  const useTRPC = createNormalizedUseTRPC(useRawTRPC);
  const ConnectionContext = createContext<ConnectionContextValue>({
    status: "idle",
    isConnected: false,
  });
  const TRPCClientContext = createContext<TRPCClientContextValue>(null);

  function useConnectionStatus() {
    return useContext(ConnectionContext);
  }

  function useTRPCClient() {
    return useContext(TRPCClientContext);
  }

  function TRPCProviderWrapper({ children }: { children: ReactNode }) {
    const [status, setStatus] = useState<ConnectionStatus>("idle");
    const previousStatusRef = useRef<ConnectionStatus>("idle");
    const queryClientRef = useRef<QueryClient | null>(null);
    const webSocketClientRef = useRef<{ close: () => Promise<void> } | null>(null);
    const outboxCoordinatorRef = useRef<WebOutboxReplayCoordinator | null>(null);
    const outboxClientRef = useRef<object | null>(null);
    const outboxRepositoryRef = useRef<WebOutboxRepository | null>(
      webOutbox ? new WebOutboxRepository() : null
    );

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

      queryClientRef.current = qc;

      const tc = createTRPCClient<TRouter>({
        links: createTRPCClientLinks<TRouter>({
          logger,
          getBaseUrl,
          getWsUrl,
          getHeaders,
          transportFetch,
          getWebSocketImpl,
          wsLazyEnabled,
          getWsLazyEnabled,
          wsLazyCloseMs,
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
            if (isNormalWebSocketClose(cause)) {
              setStatus("idle");

              return;
            }

            setStatus("disconnected");
            onWebSocketClose?.(cause);
          },
          onWebSocketUnauthorized,
          onUnauthorized,
          mutationLink,
          extraLinks: [
            ...extraLinks,
            ...(webOutbox && outboxRepositoryRef.current
              ? [
                  createWebOutboxLink({
                    repository: outboxRepositoryRef.current,
                    getUserId: webOutbox.getCaptureUserId,
                    getBackendOrigin: webOutbox.getBackendOrigin,
                    enabled: webOutbox.enabled,
                  }),
                ]
              : []),
          ],
        }),
      });

      outboxClientRef.current = tc as object;

      if (webOutbox && outboxRepositoryRef.current) {
        outboxCoordinatorRef.current = new WebOutboxReplayCoordinator({
          repository: outboxRepositoryRef.current,
          getScope: async () => {
            const userId = await webOutbox.getReplayUserId();

            return userId ? { backendOrigin: webOutbox.getBackendOrigin(), userId } : null;
          },
          deliver: (entry, input) => {
            if (!outboxClientRef.current) {
              throw new Error("tRPC client is not ready for web outbox replay");
            }

            return replayWebOutboxEntry(outboxClientRef.current, entry, input);
          },
          refetch: async () => {
            await queryClientRef.current?.refetchQueries({ type: "active" });
          },
        });
      }

      return { queryClient: qc, trpcClient: tc };
    });

    useEffect(() => {
      const coordinator = outboxCoordinatorRef.current;

      if (!coordinator) return;

      const run = () => {
        void coordinator.start();
      };
      const browserOnline = () => {
        void coordinator.start({ forceRetry: true });
      };
      const recover = () => {
        void coordinator
          .start({ forceRetry: true, refetchAfterPass: true })
          .then(() => window.dispatchEvent(new Event("norish:web-outbox-replay-settled")));
      };

      run();

      if (typeof window === "undefined") return;

      window.addEventListener("online", browserOnline);
      window.addEventListener("norish:web-connectivity-recovered", recover);
      const unsubscribeOutbox = subscribeToWebOutboxChanges(run);

      return () => {
        window.removeEventListener("online", browserOnline);
        window.removeEventListener("norish:web-connectivity-recovered", recover);
        unsubscribeOutbox();
      };
    }, []);

    useEffect(() => {
      return () => {
        const client = webSocketClientRef.current;

        webSocketClientRef.current = null;

        if (!client) {
          return;
        }

        onWebSocketClientDestroy?.(client);
        void client.close().catch(() => null);
      };
    }, [onWebSocketClientDestroy]);

    useEffect(() => {
      const wasDisconnected = previousStatusRef.current === "disconnected";

      previousStatusRef.current = status;

      if (
        status === "connected" &&
        wasDisconnected &&
        queryClientRef.current &&
        invalidateOnReconnect
      ) {
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
        <TRPCClientContext.Provider value={trpcClient as object}>
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
