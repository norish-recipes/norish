import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";
import { SERVER_CONFIG } from "@norish/config/env-config-server";

export const runtime = "nodejs";

const VALID_FILENAME_PATTERN = /^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/;
const VALID_UUID_PATTERN = /^[a-f0-9-]{36}$/i;

const IMAGE_MIMES: Record<string, string> = {
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

const VIDEO_MIMES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mkv": "video/x-matroska",
  ".avi": "video/x-msvideo",
};

function getMimeType(ext: string): { type: string; isVideo: boolean } {
  const lowerExt = ext.toLowerCase();

  if (VIDEO_MIMES[lowerExt]) {
    return { type: VIDEO_MIMES[lowerExt], isVideo: true };
  }

  return { type: IMAGE_MIMES[lowerExt] || "image/jpeg", isVideo: false };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; filename: string }> }
) {
  const { id, filename } = await params;

  // Validate id (should be a UUID)
  if (!id || !VALID_UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Invalid recipe ID" }, { status: 400 });
  }

  // Validate filename format to prevent path traversal
  if (!filename || !VALID_FILENAME_PATTERN.test(filename)) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  const recipeDir = path.join(SERVER_CONFIG.UPLOADS_DIR, "recipes", id);
  const filePath = path.join(recipeDir, filename);

  // Verify we're still within the expected directory (prevent path traversal)
  const resolvedPath = path.resolve(filePath);
  const resolvedDir = path.resolve(recipeDir);
  const relative = path.relative(resolvedDir, resolvedPath);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  try {
    const stat = await fs.stat(filePath);
    const ext = path.extname(filePath);
    const { type: mimeType, isVideo } = getMimeType(ext);

    // For videos, handle Range requests for streaming
    if (isVideo) {
      const rangeHeader = req.headers.get("range");

      if (rangeHeader) {
        // Parse range header
        const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);

        if (!match) {
          return new Response("Invalid range", { status: 416 });
        }

        const start = match[1] ? parseInt(match[1], 10) : 0;
        const end = match[2] ? parseInt(match[2], 10) : stat.size - 1;

        if (start >= stat.size || end >= stat.size || start > end) {
          return new Response("Range not satisfiable", {
            status: 416,
            headers: { "Content-Range": `bytes */${stat.size}` },
          });
        }

        const chunkSize = end - start + 1;

        // Create a readable stream for the range
        const stream = fsSync.createReadStream(filePath, { start, end });

        return new Response(stream as unknown as ReadableStream, {
          status: 206,
          headers: {
            "Content-Type": mimeType,
            "Content-Length": chunkSize.toString(),
            "Content-Range": `bytes ${start}-${end}/${stat.size}`,
            "Accept-Ranges": "bytes",
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      }

      // No range header - return full video with Accept-Ranges
      const file = await fs.readFile(filePath);

      return new Response(new Uint8Array(file), {
        headers: {
          "Content-Type": mimeType,
          "Content-Length": stat.size.toString(),
          "Accept-Ranges": "bytes",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    // For images, just return the full file
    const file = await fs.readFile(filePath);

    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (_error) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
