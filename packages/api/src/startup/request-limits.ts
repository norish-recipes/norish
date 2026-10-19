import type { IncomingMessage, ServerResponse } from "node:http";

import { MAX_BULK_IMAGE_BATCH_BODY_BYTES } from "@norish/shared/contracts";

export const BULK_IMAGE_IMPORT_PATH = "recipes.importFromImagesBatch";

export type BulkImageImportLimitVerdict = "allow" | "length-required" | "too-large";

function decodedPathname(url: string): string | null {
  try {
    let pathname = new URL(url, "http://localhost").pathname;

    for (let pass = 0; pass < 2; pass += 1) {
      const decoded = decodeURIComponent(pathname);

      if (decoded === pathname) break;

      pathname = decoded;
    }

    return pathname;
  } catch {
    return null;
  }
}

export function bulkImageImportLimitVerdict(
  url: string | undefined,
  contentLength: string | undefined,
  transferEncoding: string | undefined
): BulkImageImportLimitVerdict {
  if (!url) return "allow";

  const pathname = decodedPathname(url);

  if (pathname === null) return "length-required";
  if (!pathname.includes(BULK_IMAGE_IMPORT_PATH)) return "allow";
  if (transferEncoding) return "length-required";

  const rawLength = contentLength?.trim();

  if (!rawLength) return "length-required";

  const length = Number(rawLength);

  if (!Number.isFinite(length) || length < 0) return "length-required";

  return length > MAX_BULK_IMAGE_BATCH_BODY_BYTES ? "too-large" : "allow";
}

export function rejectBulkImageImportLimit(req: IncomingMessage, res: ServerResponse): boolean {
  const verdict = bulkImageImportLimitVerdict(
    req.url,
    req.headers["content-length"],
    req.headers["transfer-encoding"]
  );

  if (verdict === "allow") return false;

  res.statusCode = verdict === "too-large" ? 413 : 411;
  res.setHeader("connection", "close");
  res.end(verdict === "too-large" ? "Payload too large" : "Length required");
  req.destroy();

  return true;
}
