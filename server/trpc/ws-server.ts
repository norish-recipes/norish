import type { Server } from "node:http";

import { WebSocketServer } from "ws";
import { applyWSSHandler } from "@trpc/server/adapters/ws";

import { appRouter } from "./router";
import { createWsContext } from "./context";

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

  server.on("upgrade", (req, socket, head) => {
    const host = req.headers.host || "localhost";
    const url = new URL(req.url || "/", `http://${host}`);

    trpcLogger.debug({ pathname: url.pathname, host }, "WebSocket upgrade request");

    if (url.pathname === "/trpc") {
      trpcWss!.handleUpgrade(req, socket, head, (ws) => {
        trpcLogger.debug("WebSocket connection established");
        trpcWss!.emit("connection", ws, req);
      });
    }
  });

  // Cleanup on server close
  server.on("close", () => {
    trpcHandler?.broadcastReconnectNotification();
    trpcWss?.close();

    trpcWss = null;
    trpcHandler = null;
  });

  trpcLogger.info("WebSocket server started at /trpc");
}
