import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { applyWSSHandler } from "@trpc/server/adapters/ws";
import * as wsModule from "ws";

import { auth } from "@norish/auth/auth";
import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { trpcLogger } from "@norish/shared-server/logger";

import {
  registerConnection,
  startInvalidationListener,
  stopInvalidationListener,
  unregisterConnection,
} from "./connection-manager";
import { createWsContext } from "./context";
import { appRouter } from "./router";

// Extend IncomingMessage to include connectionId
declare module "node:http" {
  interface IncomingMessage {
    connectionId?: string;
  }
}

// ws exports differ between ESM (named exports) and CJS (default export with Server)
const WsServer =
  (wsModule as any).WebSocketServer ??
  (wsModule as any).Server ??
  (wsModule as any).default?.Server;

type WsServerType = InstanceType<typeof WsServer>;

// Use globalThis to survive HMR in development
const globalForWs = globalThis as unknown as {
  trpcWss: WsServerType | null;
  trpcHandler: ReturnType<typeof applyWSSHandler> | null;
};

let trpcWss = globalForWs.trpcWss ?? null;
let trpcHandler = globalForWs.trpcHandler ?? null;

export function initTrpcWebSocket(server: Server) {
  if (trpcWss) {
    trpcLogger.warn("WebSocket server already initialized");

    return;
  }

  trpcWss = new WsServer({ noServer: true });
  globalForWs.trpcWss = trpcWss;

  trpcHandler = applyWSSHandler({
    wss: trpcWss,
    router: appRouter,
    createContext: createWsContext,
    keepAlive: {
      enabled: true,
      pingMs: 20000, // Send ping every 20 seconds
      pongWaitMs: 5000, // Wait 5 seconds for pong before closing
    },
  });
  globalForWs.trpcHandler = trpcHandler;

  server.on("upgrade", async (req, socket, head) => {
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

    // Pre-authenticate to get userId for connection tracking
    const headers = new Headers();

    if (req.headers.cookie) headers.set("cookie", String(req.headers.cookie));
    if (req.headers["x-api-key"]) headers.set("x-api-key", String(req.headers["x-api-key"]));

    let userId: string | undefined;

    try {
      const session = await auth.api.getSession({ headers });

      userId = session?.user?.id;
      if (!session || !session.user) {
        throw new Error("No session");
      }
    } catch {
      trpcLogger.debug("Rejecting unauthenticated WebSocket connection");
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();

      return;
    }

    trpcWss!.handleUpgrade(req, socket, head, (ws: wsModule.WebSocket) => {
      // Generate unique connection ID for multiplexer management
      const connectionId = randomUUID();

      req.connectionId = connectionId;
      trpcLogger.trace({ userId, connectionId }, "WebSocket connection established");

      // Track connection by userId for server-side termination
      if (userId) {
        registerConnection(userId, ws, connectionId);
        ws.on("close", () => unregisterConnection(userId, ws));
      }

      trpcWss!.emit("connection", ws, req);
    });
  });

  // Start listening for connection invalidation events
  startInvalidationListener().catch((err) => {
    trpcLogger.error({ err }, "Failed to start invalidation listener");
  });

  server.on("close", async () => {
    trpcHandler?.broadcastReconnectNotification();
    await stopInvalidationListener();
    trpcWss?.close();

    trpcWss = null;
    trpcHandler = null;
    globalForWs.trpcWss = null;
    globalForWs.trpcHandler = null;
  });

  trpcLogger.info("WebSocket server started at /trpc");
}
