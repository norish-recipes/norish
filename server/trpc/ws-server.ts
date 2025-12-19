import type { Server } from "node:http";

import { WebSocketServer } from "ws";
import { applyWSSHandler } from "@trpc/server/adapters/ws";

import { appRouter } from "./router";
import { createWsContext } from "./context";
import {
  registerConnection,
  unregisterConnection,
  startInvalidationListener,
} from "./connection-manager";

import { auth } from "@/server/auth/auth";
import { trpcLogger } from "@/server/logger";

let trpcWss: WebSocketServer | null = null;
let trpcHandler: ReturnType<typeof applyWSSHandler> | null = null;

export function initTrpcWebSocket(server: Server) {
  if (trpcWss) {
    trpcLogger.warn("WebSocket server already initialized");

    return;
  }

  trpcWss = new WebSocketServer({ noServer: true });

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

  server.on("upgrade", async (req, socket, head) => {
    const host = req.headers.host || "localhost";
    const url = new URL(req.url || "/", `http://${host}`);

    trpcLogger.trace({ pathname: url.pathname, host }, "WebSocket upgrade request");

    if (url.pathname === "/trpc") {
      // Pre-authenticate to get userId for connection tracking
      const headers = new Headers();

      if (req.headers.cookie) headers.set("cookie", String(req.headers.cookie));
      if (req.headers["x-api-key"]) headers.set("x-api-key", String(req.headers["x-api-key"]));

      let userId: string | undefined;

      try {
        const session = await auth.api.getSession({ headers });

        userId = session?.user?.id;
      } catch {
        // Auth failed, let createWsContext handle rejection
      }

      trpcWss!.handleUpgrade(req, socket, head, (ws) => {
        trpcLogger.trace({ userId }, "WebSocket connection established");

        // Track connection by userId for server-side termination
        if (userId) {
          registerConnection(userId, ws);
          ws.on("close", () => unregisterConnection(userId, ws));
        }

        trpcWss!.emit("connection", ws, req);
      });
    }
  });

  // Start listening for connection invalidation events
  startInvalidationListener().catch((err) => {
    trpcLogger.error({ err }, "Failed to start invalidation listener");
  });

  server.on("close", () => {
    trpcHandler?.broadcastReconnectNotification();
    trpcWss?.close();

    trpcWss = null;
    trpcHandler = null;
  });

  trpcLogger.info("WebSocket server started at /trpc");
}
