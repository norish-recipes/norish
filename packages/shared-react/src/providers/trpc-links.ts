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

export type CreateTRPCProviderBundleOptions = {
  logger: TrpcLogger;
  getBaseUrl?: () => string;
  getWsUrl?: () => string;
  getHeaders?: () => HTTPHeaders;
  getWebSocketImpl?: () => typeof WebSocket | undefined;
  wsLazyEnabled?: boolean;
  getWsLazyEnabled?: () => boolean;
  wsLazyCloseMs?: number;

  enableLoggerLink?: boolean;
  getQueryClient?: () => import("@tanstack/react-query").QueryClient;
  onWebSocketClose?: (cause: unknown) => void;
  onWebSocketOpen?: () => void;
  onWebSocketUnauthorized?: (cause: unknown) => void;
  onWebSocketClientCreate?: (client: ManagedWebSocketClient) => void;
  onWebSocketClientDestroy?: (client: ManagedWebSocketClient) => void;
  onUnauthorized?: (cause: unknown) => void;
  mutationLink?: TRPCLink<any>;
  extraLinks?: TRPCLink<any>[];
  /** Automatically invalidate all queries on WebSocket reconnect. Defaults to true. */
  invalidateOnReconnect?: boolean;
};

type CreateTRPCClientLinksOptions = CreateTRPCProviderBundleOptions & {
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

function getWebSocketCloseReason(cause: unknown): string | null {
  if (!cause || typeof cause !== "object") {
    return null;
  }

  const event = cause as {
    reason?: unknown;
    _reason?: unknown;
    message?: unknown;
  };

  if (typeof event.reason === "string" && event.reason.length > 0) {
    return event.reason;
  }

  if (typeof event._reason === "string" && event._reason.length > 0) {
    return event._reason;
  }

  if (typeof event.message === "string" && event.message.length > 0) {
    return event.message;
  }

  return null;
}

export function isNormalWebSocketClose(cause: unknown): boolean {
  return getWebSocketCloseCode(cause) === 1000;
}

export function isUnauthorizedWebSocketClose(cause: unknown): boolean {
  const code = getWebSocketCloseCode(cause);

  if (code === 4401) {
    return true;
  }

  const reason = getWebSocketCloseReason(cause);

  if (!reason) {
    return false;
  }

  return /(?:^|\b)(401|unauthorized)(?:\b|$)/i.test(reason);
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
    message?: unknown;
  };

  if (error.data?.code === "UNAUTHORIZED" || error.shape?.data?.code === "UNAUTHORIZED") {
    return true;
  }

  if (error.data?.httpStatus === 401 || error.shape?.data?.httpStatus === 401) {
    return true;
  }

  return (
    typeof error.message === "string" && /(?:^|\b)(401|unauthorized)(?:\b|$)/i.test(error.message)
  );
}

export function shouldNotifyWebSocketDisconnect(cause: unknown): boolean {
  return !isNormalWebSocketClose(cause) && !isUnauthorizedWebSocketClose(cause);
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

function createHttpMutationLink(
  getBaseUrl: () => string,
  getHeaders: () => HTTPHeaders
): TRPCLink<any> {
  return httpLink({
    url: `${getBaseUrl()}/api/trpc`,
    headers: createRequestHeadersResolver(getHeaders),
    transformer: superjson as any,
  });
}

function createHttpFormDataMutationLink(
  getBaseUrl: () => string,
  getHeaders: () => HTTPHeaders
): TRPCLink<any> {
  return httpLink({
    url: `${getBaseUrl()}/api/trpc`,
    headers: createRequestHeadersResolver(getHeaders),
    transformer: {
      serialize: (data: unknown) => data,
      deserialize: superjson.deserialize,
    } as any,
  });
}

function createHttpTransportLink<TRouter extends AnyTRPCRouter>(
  getBaseUrl: () => string,
  getHeaders: () => HTTPHeaders
): TRPCLink<TRouter> {
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
      transformer: superjson as any,
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
  getWsLazyEnabled,
  wsLazyCloseMs = 0,

  enableLoggerLink = true,
  onWebSocketClose,
  onWebSocketOpen,
  onWebSocketUnauthorized,
  onWebSocketClientCreate,
  onUnauthorized,
  mutationLink,
  extraLinks = [],
}: CreateTRPCClientLinksOptions): TRPCLink<TRouter>[] {
  const resolvedWsLazyEnabled = getWsLazyEnabled?.() ?? wsLazyEnabled;
  const webSocketClient = includeSubscriptions
    ? createWsClient(
        getWsUrl,
        getWebSocketImpl,
        resolvedWsLazyEnabled,
        wsLazyCloseMs,
        logger,
        onWebSocketOpen,
        onWebSocketClose,
        onWebSocketUnauthorized
      )
    : null;

  if (webSocketClient) {
    onWebSocketClientCreate?.(webSocketClient);
  }

  const transportLink = includeSubscriptions
    ? splitLink({
        condition: (op) => op.type === "subscription",
        true: wsLink({
          client: webSocketClient!,
          transformer: superjson as any,
        }),
        false: createHttpTransportLink(getBaseUrl, getHeaders),
      })
    : createHttpTransportLink(getBaseUrl, getHeaders);

  return [
    ...(enableLoggerLink
      ? [
          loggerLink({
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

function createWsClient(
  getWsUrl: () => string,
  getWebSocketImpl: (() => typeof WebSocket | undefined) | undefined,
  wsLazyEnabled: boolean,
  wsLazyCloseMs: number,
  logger: TrpcLogger,
  onWebSocketOpen: (() => void) | undefined,
  onWebSocketClose: ((cause: unknown) => void) | undefined,
  onWebSocketUnauthorized: ((cause: unknown) => void) | undefined
) {
  let handledUnauthorizedClose = false;
  let suppressNextNormalClose = false;
  let webSocketClient: ReturnType<typeof createWSClient> | null = null;

  webSocketClient = createWSClient({
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

      logger.debug({ attemptIndex }, "WebSocket reconnecting in 1s");

      return 1000;
    },
    onOpen: () => {
      logger.info("WebSocket connected");
      onWebSocketOpen?.();
    },
    onClose: (cause) => {
      logger.info(`WebSocket closed: ${JSON.stringify(cause)}`);

      if (isUnauthorizedWebSocketClose(cause)) {
        if (!handledUnauthorizedClose) {
          handledUnauthorizedClose = true;
          suppressNextNormalClose = true;
          onWebSocketClose?.(cause);
          onWebSocketUnauthorized?.(cause);
          void webSocketClient?.close().catch(() => null);
        }

        return;
      }

      if (isNormalWebSocketClose(cause)) {
        if (suppressNextNormalClose) {
          suppressNextNormalClose = false;

          return;
        }

        onWebSocketClose?.(cause);

        return;
      }

      onWebSocketClose?.(cause);
    },
  });

  return webSocketClient;
}
