/**
 * tRPC WebSocket server
 *
 * One `upgrade` handler on the HTTP server owns the `/trpc` socket path. It
 * refuses foreign origins, verifies the session exactly once and hands the
 * verified user to the WS context on the request itself, tells an
 * unauthenticated client so with close code 4401 after the handshake, and
 * shuts down in seconds: `stopTrpcWebSocket()` closes every socket with 1012
 * and is awaited from the graceful shutdown right after the HTTP server.
 */

import { randomUUID } from "node:crypto";
import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import { applyWSSHandler } from "@trpc/server/adapters/ws";
import * as wsModule from "ws";

import type { User } from "@norish/shared/contracts";
import { getVerifiedSession } from "@norish/auth/session";
import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { trpcLogger } from "@norish/shared-server/logger";

import {
  registerConnection,
  startConnectionInvalidation,
  unregisterConnection,
} from "./connection-manager";
import { createWsContext } from "./context";
import { appRouter } from "./router";

/** Close codes this server sends; the client acts on the code alone, never on the reason. */
export const WS_CLOSE_UNAUTHORIZED = 4401;
export const WS_CLOSE_SERVICE_RESTART = 1012;

/** How long a client gets to answer the 1012 close frame before its socket is dropped. */
const CLOSE_GRACE_MS = 2_000;

// ws exports differ between ESM (named exports) and CJS (default export with Server)
const wsInterop = wsModule as unknown as {
  WebSocketServer?: typeof wsModule.WebSocketServer;
  Server?: typeof wsModule.WebSocketServer;
  default?: { Server?: typeof wsModule.WebSocketServer };
};
const resolvedWsServer = wsInterop.WebSocketServer ?? wsInterop.Server ?? wsInterop.default?.Server;

if (!resolvedWsServer) {
  throw new Error("ws module does not export a WebSocket server constructor");
}

const WsServer = resolvedWsServer;

type WsServerType = InstanceType<typeof WsServer>;

type UpgradeListener = (req: IncomingMessage, socket: Duplex, head: Buffer) => void;

// Use globalThis to survive HMR in development
const globalForWs = globalThis as unknown as {
  trpcWss: WsServerType | null;
  trpcHandler: ReturnType<typeof applyWSSHandler> | null;
  trpcUpgrade: { server: Server; listener: UpgradeListener } | null;
  stopConnectionInvalidation: (() => void) | null;
};

let trpcWss = globalForWs.trpcWss ?? null;
let trpcHandler = globalForWs.trpcHandler ?? null;
let trpcUpgrade = globalForWs.trpcUpgrade ?? null;
let stopConnectionInvalidation = globalForWs.stopConnectionInvalidation ?? null;

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * Whether a browser's `Origin` may ride its session cookie onto the socket.
 *
 * An absent header is accepted (native clients, `curl`). A present one must be
 * the origin of `AUTH_URL`, an entry of `TRUSTED_ORIGINS`, or the request's own
 * host under either scheme — a TLS-terminating proxy makes the socket `http`
 * while the browser saw `https`, and a page on the same host is this instance.
 */
export function isTrustedWebSocketOrigin(
  origin: string | undefined,
  requestHost: string | undefined
): boolean {
  if (origin === undefined) return true;

  const candidate = originOf(origin);

  if (candidate === null) return false;

  const trusted = new Set<string>();
  const authOrigin = originOf(SERVER_CONFIG.AUTH_URL);

  if (authOrigin) trusted.add(authOrigin);

  for (const entry of SERVER_CONFIG.TRUSTED_ORIGINS) {
    const trustedOrigin = originOf(entry);

    if (trustedOrigin) trusted.add(trustedOrigin);
  }

  if (requestHost) {
    for (const scheme of ["http", "https"]) {
      const hostOrigin = originOf(`${scheme}://${requestHost}`);

      if (hostOrigin) trusted.add(hostOrigin);
    }
  }

  return trusted.has(candidate);
}

function headersForSession(req: IncomingMessage): Headers {
  const headers = new Headers();

  if (req.headers.cookie) headers.set("cookie", String(req.headers.cookie));
  if (req.headers["x-api-key"]) headers.set("x-api-key", String(req.headers["x-api-key"]));

  return headers;
}

export function initTrpcWebSocket(server: Server) {
  if (trpcWss) {
    trpcLogger.warn("WebSocket server already initialized");

    return;
  }

  const wss = new WsServer({ noServer: true });

  trpcWss = wss;
  globalForWs.trpcWss = wss;

  trpcHandler = applyWSSHandler({
    wss,
    router: appRouter,
    createContext: createWsContext,
    keepAlive: {
      enabled: true,
      pingMs: 20000, // Send ping every 20 seconds
      pongWaitMs: 5000, // Wait 5 seconds for pong before closing
    },
  });
  globalForWs.trpcHandler = trpcHandler;

  const onUpgrade: UpgradeListener = async (req, socket, head) => {
    const host = req.headers.host || "localhost";
    const url = new URL(req.url || "/", `http://${host}`);

    trpcLogger.trace({ pathname: url.pathname, host }, "WebSocket upgrade request");

    // Only handle /trpc WebSocket path
    if (url.pathname !== "/trpc") {
      // In development, let Next.js HMR handle other WebSocket paths
      // In production, reject unknown WebSocket upgrades to prevent socket leaks
      if (SERVER_CONFIG.NODE_ENV !== "development") {
        trpcLogger.debug({ pathname: url.pathname }, "Rejecting non-tRPC WebSocket upgrade");
        socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
        socket.destroy();
      }

      return;
    }

    // A foreign page must not ride the browser's session cookie onto this socket.
    if (!isTrustedWebSocketOrigin(req.headers.origin, req.headers.host)) {
      trpcLogger.warn(
        { origin: req.headers.origin, host },
        "Rejecting cross-origin WebSocket upgrade"
      );
      socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
      socket.destroy();

      return;
    }

    // Authenticate once; the WS context reads the result off the request.
    let identity: User | null = null;

    try {
      const verified = await getVerifiedSession(headersForSession(req));

      if (verified) {
        identity = {
          id: verified.id,
          email: verified.email,
          name: verified.name,
          image: verified.image,
          version: verified.version,
          isServerAdmin: verified.isServerAdmin,
        };
      }
    } catch (err) {
      trpcLogger.warn({ err }, "WebSocket session verification failed");
    }

    if (trpcWss !== wss) {
      // Shut down while the session was being verified.
      socket.destroy();

      return;
    }

    if (!identity) {
      // Complete the handshake so the client can read a close code — 4401 says
      // "sign in again", which no amount of reconnecting will fix.
      trpcLogger.debug("Closing unauthenticated WebSocket connection");
      wss.handleUpgrade(req, socket, head, (ws: wsModule.WebSocket) => {
        ws.close(WS_CLOSE_UNAUTHORIZED, "Unauthorized");
      });

      return;
    }

    const user = identity;

    req.realtimeIdentity = user;

    wss.handleUpgrade(req, socket, head, (ws: wsModule.WebSocket) => {
      const connectionId = randomUUID();

      req.connectionId = connectionId;
      trpcLogger.trace({ userId: user.id, connectionId }, "WebSocket connection established");

      // Track connection by userId for server-side termination
      registerConnection(user.id, ws);
      ws.on("close", () => {
        try {
          unregisterConnection(user.id, ws);
        } catch (err) {
          trpcLogger.error({ err, userId: user.id }, "Failed to unregister WebSocket connection");
        }
      });

      wss.emit("connection", ws, req);
    });
  };

  server.on("upgrade", onUpgrade);
  trpcUpgrade = { server, listener: onUpgrade };
  globalForWs.trpcUpgrade = trpcUpgrade;

  // Scope Changes announced by any process close this one's sockets (ADR-0033).
  // The hub is started before the HTTP server, so the registration is immediate.
  try {
    stopConnectionInvalidation = startConnectionInvalidation();
    globalForWs.stopConnectionInvalidation = stopConnectionInvalidation;
  } catch (err) {
    trpcLogger.error({ err }, "Failed to start invalidation listener");
  }

  trpcLogger.info("WebSocket server started at /trpc");
}

/**
 * Close every socket with 1012 Service Restart and resolve once the server is
 * closed. Clients get `CLOSE_GRACE_MS` to answer the close frame; a socket that
 * does not is dropped, so a restart never waits on a dead client. Awaited from
 * the graceful shutdown right after the HTTP server stops accepting requests.
 */
export async function stopTrpcWebSocket(): Promise<void> {
  const wss = trpcWss;
  const handler = trpcHandler;
  const upgrade = trpcUpgrade;
  const stopInvalidation = stopConnectionInvalidation;

  trpcWss = null;
  trpcHandler = null;
  trpcUpgrade = null;
  stopConnectionInvalidation = null;
  globalForWs.trpcWss = null;
  globalForWs.trpcHandler = null;
  globalForWs.trpcUpgrade = null;
  globalForWs.stopConnectionInvalidation = null;

  if (!wss) return;

  upgrade?.server.off("upgrade", upgrade.listener);
  stopInvalidation?.();
  handler?.broadcastReconnectNotification();

  const open = [...wss.clients];

  for (const client of open) {
    client.close(WS_CLOSE_SERVICE_RESTART, "Service Restart");
  }

  const grace = setTimeout(() => {
    for (const client of wss.clients) client.terminate();
  }, CLOSE_GRACE_MS);

  grace.unref();

  try {
    await new Promise<void>((resolve, reject) => {
      wss.close((err) => (err ? reject(err) : resolve()));
    });
  } finally {
    clearTimeout(grace);
  }

  trpcLogger.info({ closed: open.length }, "WebSocket server stopped");
}
