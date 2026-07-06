import { createReadStream, existsSync, statSync } from "fs";
import { IncomingMessage, ServerResponse } from "http";
import { extname, join } from "path";
import { createGzip } from "zlib";
import mime from "mime";

import { SERVER_CONFIG } from "@norish/config/env-config-server";
import { resolveExistingWorkspacePath } from "@norish/shared-server/lib/workspace-paths";
import { serverLogger } from "@norish/shared-server/logger";

const STATIC_EXCLUDED_PATHS = ["/", "/manifest.webmanifest", "/_next", "/api"];

const GZIP_MIME_TYPES = ["text/", "application/javascript", "application/json", "image/svg"];
const STATIC_PUBLIC_DIR = resolveExistingWorkspacePath(join("apps", "web", "public"));

export function serveStaticFile(req: IncomingMessage, res: ServerResponse): boolean {
  try {
    const url = new URL(req.url!, SERVER_CONFIG.AUTH_URL);
    const pathname = url.pathname;

    // Skip Next.js and API routes
    if (STATIC_EXCLUDED_PATHS.some((path) => pathname === path || pathname.startsWith(path))) {
      return false;
    }

    const filePath = join(STATIC_PUBLIC_DIR, pathname);

    if (!existsSync(filePath)) return false;

    const stat = statSync(filePath);

    if (stat.isDirectory()) return false;

    const ext = extname(filePath).toLowerCase();
    const mimeType = mime.getType(ext) || "application/octet-stream";

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

    const shouldGzip = GZIP_MIME_TYPES.some((type) => mimeType.startsWith(type));

    if (shouldGzip) {
      res.setHeader("Content-Encoding", "gzip");
      createReadStream(filePath).pipe(createGzip()).pipe(res);
    } else {
      res.setHeader("Content-Length", stat.size);
      createReadStream(filePath).pipe(res);
    }

    if (SERVER_CONFIG.NODE_ENV === "development") {
      serverLogger.debug({ pathname }, "Serving static file");
    }

    return true;
  } catch (err) {
    serverLogger.error({ err }, "Static file error");

    return false;
  }
}
