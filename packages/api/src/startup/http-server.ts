import http from "node:http";
import { join } from "node:path";
import { parse } from "node:url";
import next from "next";

import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { resolveExistingWorkspacePath } from "@norish/shared-server/lib/workspace-paths";
import { serverLogger } from "@norish/shared-server/logger";
import { initTrpcWebSocket } from "@norish/trpc/server";

import { serveStaticFile } from "./static-files";

const WEB_APP_DIR = resolveExistingWorkspacePath(join("apps", "web"));

export async function createServer() {
  const dev = SERVER_CONFIG.NODE_ENV === "development";
  const hostname = dev ? "0.0.0.0" : SERVER_CONFIG.HOST;
  const port = SERVER_CONFIG.PORT;

  const app = next({ dev, dir: WEB_APP_DIR, hostname, port, turbopack: dev });
  const handle = app.getRequestHandler();

  await app.prepare();

  const server = http.createServer(async (req, res) => {
    try {
      // Serve static files from uploads directory
      if (serveStaticFile(req, res)) return;

      // Let Next.js handle all other requests (including /api/trpc/*)
      const parsedUrl = parse(req.url || "/", true);

      await handle(req, res, parsedUrl);
    } catch (err) {
      serverLogger.error({ err }, "Request error");
      res.statusCode = 500;
      res.end("Internal server error");
    }
  });

  // Initialize tRPC WebSocket - handles upgrade for /trpc path
  initTrpcWebSocket(server);

  return { server, hostname, port };
}
