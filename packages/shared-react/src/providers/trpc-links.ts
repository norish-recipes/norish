/**
 * tRPC client links
 *
 * Subscriptions ride one WebSocket; everything else goes over HTTP. The
 * socket reconnects with full-jitter exponential backoff, stops for good on
 * a 4401 close (the server's "sign in again", which no reconnect will fix),
 * and reports every close — a normal 1000 included — to the provider.
 */

import type { HTTPHeaders, TRPCLink } from "@trpc/client";
import type { AnyTRPCRouter } from "@trpc/server";
import {
  createWSClient,
  httpBatchLink,
  httpLink,
  isNonJsonSerializable,
  loggerLink,
  splitLink,
  TRPCClientError,
  wsLink,
} from "@trpc/client";
import { observable } from "@trpc/server/observable";
import superjson from "superjson";

import { createOperationIdLink } from "./operation-id-link";
import { createBatchRequestHeadersResolver, createRequestHeadersResolver } from "./request-headers";

export type TrpcLogger = {
  info: (message: string) => void;
  warn: (meta: unknown, message: string) => void;
  debug: (meta: unknown, message: string) => void;
};

type ManagedWebSocketClient = {
  close: () => Promise<void>;
};

/** The close code the server sends when the socket's session is not valid. */
export const WS_CLOSE_UNAUTHORIZED = 4401;

/** The longest wait between two reconnect attempts. */
export const WS_RETRY_MAX_DELAY_MS = 30_000;

export type CreateTRPCProviderBundleOptions<TRouter extends AnyTRPCRouter> = {
  logger: TrpcLogger;
  getBaseUrl?: () => string;
  getWsUrl?: () => string;
  getHeaders?: () => HTTPHeaders;
  getWebSocketImpl?: () => typeof WebSocket | undefined;
  wsLazyEnabled?: boolean;
  wsLazyCloseMs?: number;
  /** The RNG behind the reconnect jitter; injectable so a test is deterministic. */
  retryRandom?: () => number;

  enableLoggerLink?: boolean;
  getQueryClient?: () => import("@tanstack/react-query").QueryClient;
  /** Every close of the socket, a normal one included. */
  onWebSocketClose?: (cause: unknown) => void;
  onWebSocketOpen?: () => void;
  /** Once per client instance: the server closed the socket with 4401. */
  onWebSocketUnauthorized?: (cause: unknown) => void;
  onWebSocketClientCreate?: (client: ManagedWebSocketClient) => void;
  onUnauthorized?: (cause: unknown) => void;
  mutationLink?: TRPCLink<TRouter>;
  extraLinks?: TRPCLink<TRouter>[];
};

type CreateTRPCClientLinksOptions<TRouter extends AnyTRPCRouter> =
  CreateTRPCProviderBundleOptions<TRouter> & {
    includeSubscriptions?: boolean;
  };

function getWebSocketCloseCode(cause: unknown): number | null {
  if (!cause || typeof cause !== "object") {
    return null;
  }

  const event = cause as { code?: unknown; _code?: unknown };

  if (typeof event.code === "number") {
    return event.code;
  }

  if (typeof event._code === "number") {
    return event._code;
  }

  return null;
}

export function isNormalWebSocketClose(cause: unknown): boolean {
  return getWebSocketCloseCode(cause) === 1000;
}

/** The server said so with its close code; nothing else counts. */
export function isUnauthorizedWebSocketClose(cause: unknown): boolean {
  return getWebSocketCloseCode(cause) === WS_CLOSE_UNAUTHORIZED;
}

export function isUnauthorizedTRPCError(cause: unknown): boolean {
  if (!cause) {
    return false;
  }

  if (cause instanceof TRPCClientError) {
    return (
      cause.data?.code === "UNAUTHORIZED" ||
      cause.data?.httpStatus === 401 ||
      cause.shape?.data?.code === "UNAUTHORIZED" ||
      cause.shape?.data?.httpStatus === 401
    );
  }

  if (typeof cause !== "object") {
    return false;
  }

  const error = cause as {
    data?: { code?: unknown; httpStatus?: unknown };
    shape?: { data?: { code?: unknown; httpStatus?: unknown } };
  };

  if (error.data?.code === "UNAUTHORIZED" || error.shape?.data?.code === "UNAUTHORIZED") {
    return true;
  }

  return error.data?.httpStatus === 401 || error.shape?.data?.httpStatus === 401;
}

/**
 * Full-jitter exponential backoff: anywhere between zero and the doubling
 * ceiling, so a fleet of clients cut off together does not return together.
 */
export function webSocketRetryDelayMs(attemptIndex: number, random: () => number = Math.random) {
  return random() * Math.min(WS_RETRY_MAX_DELAY_MS, 1_000 * 2 ** attemptIndex);
}

function createUnauthorizedLink<TRouter extends AnyTRPCRouter>(
  onUnauthorized: ((cause: unknown) => void) | undefined
): TRPCLink<TRouter> {
  return () => {
    return ({ op, next }) => {
      return observable((observer) => {
        return next(op).subscribe({
          next(result) {
            observer.next(result);
          },
          error(error) {
            if (isUnauthorizedTRPCError(error)) {
              onUnauthorized?.(error);
            }

            observer.error(error);
          },
          complete() {
            observer.complete();
          },
        });
      });
    };
  };
}

/**
 * The HTTP links are built against `AnyTRPCRouter`: tRPC types the transformer
 * option on the router's client types, and for a generic router that
 * conditional never resolves. A link over `AnyTRPCRouter` is a `TRPCLink` of
 * the concrete router too, so `createTRPCClientLinks` returns them typed.
 */
function createHttpMutationLink(
  getBaseUrl: () => string,
  getHeaders: () => HTTPHeaders
): TRPCLink<AnyTRPCRouter> {
  return httpLink({
    url: `${getBaseUrl()}/api/trpc`,
    headers: createRequestHeadersResolver(getHeaders),
    transformer: superjson,
  });
}

function createHttpFormDataMutationLink(
  getBaseUrl: () => string,
  getHeaders: () => HTTPHeaders
): TRPCLink<AnyTRPCRouter> {
  return httpLink({
    url: `${getBaseUrl()}/api/trpc`,
    headers: createRequestHeadersResolver(getHeaders),
    transformer: {
      serialize: (data: unknown) => data,
      deserialize: superjson.deserialize,
    },
  });
}

function createHttpTransportLink(
  getBaseUrl: () => string,
  getHeaders: () => HTTPHeaders
): TRPCLink<AnyTRPCRouter> {
  return splitLink({
    condition: (op) => op.type === "mutation",
    true: splitLink({
      condition: (op) => isNonJsonSerializable(op.input),
      true: createHttpFormDataMutationLink(getBaseUrl, getHeaders),
      false: createHttpMutationLink(getBaseUrl, getHeaders),
    }),
    false: httpBatchLink({
      url: `${getBaseUrl()}/api/trpc`,
      headers: createBatchRequestHeadersResolver(getHeaders),
      transformer: superjson,
    }),
  });
}

export const defaultGetBaseUrl = () => {
  if (typeof window !== "undefined") {
    return "";
  }

  return `http://localhost:${process.env.PORT ?? 3000}`;
};

export const defaultGetWsUrl = () => {
  if (typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";

    return `${protocol}//${window.location.host}/trpc`;
  }

  return `ws://localhost:${process.env.PORT ?? 3000}/trpc`;
};

export const defaultGetHeaders = (): HTTPHeaders => ({});

export function createTRPCClientLinks<TRouter extends AnyTRPCRouter>({
  logger,
  getBaseUrl = defaultGetBaseUrl,
  getWsUrl = defaultGetWsUrl,
  getHeaders = defaultGetHeaders,
  getWebSocketImpl,
  includeSubscriptions = true,
  wsLazyEnabled = true,
  wsLazyCloseMs = 0,
  retryRandom = Math.random,

  enableLoggerLink = true,
  onWebSocketClose,
  onWebSocketOpen,
  onWebSocketUnauthorized,
  onWebSocketClientCreate,
  onUnauthorized,
  mutationLink,
  extraLinks = [],
}: CreateTRPCClientLinksOptions<TRouter>): TRPCLink<TRouter>[] {
  const webSocketClient = includeSubscriptions
    ? createWsClient({
        getWsUrl,
        getWebSocketImpl,
        wsLazyEnabled,
        wsLazyCloseMs,
        retryRandom,
        logger,
        onWebSocketOpen,
        onWebSocketClose,
        onWebSocketUnauthorized,
      })
    : null;

  if (webSocketClient) {
    onWebSocketClientCreate?.(webSocketClient);
  }

  const transportLink: TRPCLink<TRouter> = webSocketClient
    ? splitLink<TRouter>({
        condition: (op) => op.type === "subscription",
        true: wsLink<TRouter>({
          client: webSocketClient,
          transformer: superjson,
        }),
        false: createHttpTransportLink(getBaseUrl, getHeaders),
      })
    : createHttpTransportLink(getBaseUrl, getHeaders);

  return [
    ...(enableLoggerLink
      ? [
          loggerLink<TRouter>({
            enabled: (opts) =>
              process.env.NODE_ENV === "development" ||
              (opts.direction === "down" && opts.result instanceof Error),
          }),
        ]
      : []),
    createOperationIdLink<TRouter>(),
    createUnauthorizedLink<TRouter>(onUnauthorized),
    ...(mutationLink ? [mutationLink] : []),
    ...extraLinks,
    transportLink,
  ];
}

type CreateWsClientOptions = {
  getWsUrl: () => string;
  getWebSocketImpl: (() => typeof WebSocket | undefined) | undefined;
  wsLazyEnabled: boolean;
  wsLazyCloseMs: number;
  retryRandom: () => number;
  logger: TrpcLogger;
  onWebSocketOpen: (() => void) | undefined;
  onWebSocketClose: ((cause: unknown) => void) | undefined;
  onWebSocketUnauthorized: ((cause: unknown) => void) | undefined;
};

function createWsClient({
  getWsUrl,
  getWebSocketImpl,
  wsLazyEnabled,
  wsLazyCloseMs,
  retryRandom,
  logger,
  onWebSocketOpen,
  onWebSocketClose,
  onWebSocketUnauthorized,
}: CreateWsClientOptions) {
  // Per client instance: a client created after re-login retries normally.
  let handledUnauthorizedClose = false;

  const webSocketClient = createWSClient({
    url: getWsUrl,
    WebSocket: getWebSocketImpl?.(),
    lazy: {
      enabled: wsLazyEnabled,
      closeMs: wsLazyCloseMs,
    },
    retryDelayMs: (attemptIndex) => {
      if (handledUnauthorizedClose) {
        return 0;
      }

      const delayMs = webSocketRetryDelayMs(attemptIndex, retryRandom);

      logger.debug({ attemptIndex, delayMs }, "WebSocket reconnecting");

      return delayMs;
    },
    onOpen: () => {
      logger.info("WebSocket connected");
      onWebSocketOpen?.();
    },
    onClose: (cause) => {
      logger.info(`WebSocket closed: ${JSON.stringify(cause)}`);
      onWebSocketClose?.(cause);

      if (!isUnauthorizedWebSocketClose(cause) || handledUnauthorizedClose) {
        return;
      }

      // The session is gone: stop the client, which ends reconnecting, and
      // tell the app once so it can route to sign-in.
      handledUnauthorizedClose = true;
      onWebSocketUnauthorized?.(cause);
      void webSocketClient.close().catch(() => null);
    },
  });

  return webSocketClient;
}
