import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

import { SERVER_CONFIG } from "@norish/config/env-config-server";

const VALID_FILENAME_PATTERN = /^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/;

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

function getRecipeMediaMimeType(ext: string): { type: string; isVideo: boolean } {
  const lowerExt = ext.toLowerCase();

  if (VIDEO_MIMES[lowerExt]) {
    return { type: VIDEO_MIMES[lowerExt], isVideo: true };
  }

  return { type: IMAGE_MIMES[lowerExt] || "image/jpeg", isVideo: false };
}

function validateFilename(filename: string): Response | null {
  if (!filename || !VALID_FILENAME_PATTERN.test(filename)) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  if (filename.includes("/") || filename.includes("\\") || filename.includes("..")) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  return null;
}

function resolveSafeFilePath(rootDir: string, filename: string): string | null {
  const filePath = path.join(rootDir, filename);
  const resolvedPath = path.resolve(filePath);
  const resolvedDir = path.resolve(rootDir);
  const relative = path.relative(resolvedDir, resolvedPath);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }

  return filePath;
}

async function serveRecipeMediaFileResponse(req: Request, filePath: string, cacheControl: string) {
  try {
    const stat = await fs.stat(filePath);
    const ext = path.extname(filePath);
    const { type: mimeType, isVideo } = getRecipeMediaMimeType(ext);

    if (isVideo) {
      const rangeHeader = req.headers.get("range");

      if (rangeHeader) {
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
        const stream = fsSync.createReadStream(filePath, { start, end });

        return new Response(stream as unknown as ReadableStream, {
          status: 206,
          headers: {
            "Content-Type": mimeType,
            "Content-Length": chunkSize.toString(),
            "Content-Range": `bytes ${start}-${end}/${stat.size}`,
            "Accept-Ranges": "bytes",
            "Cache-Control": cacheControl,
          },
        });
      }

      const file = await fs.readFile(filePath);

      return new Response(new Uint8Array(file), {
        headers: {
          "Content-Type": mimeType,
          "Content-Length": stat.size.toString(),
          "Accept-Ranges": "bytes",
          "Cache-Control": cacheControl,
        },
      });
    }

    const file = await fs.readFile(filePath);

    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": cacheControl,
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function serveRecipeMedia(
  req: Request,
  recipeId: string,
  filename: string,
  cacheControl: string
) {
  const invalidFilename = validateFilename(filename);

  if (invalidFilename) {
    return invalidFilename;
  }

  const recipeDir = path.join(SERVER_CONFIG.UPLOADS_DIR, "recipes", recipeId);
  const filePath = resolveSafeFilePath(recipeDir, filename);

  if (!filePath) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  return serveRecipeMediaFileResponse(req, filePath, cacheControl);
}

export async function serveRecipeStepMedia(
  recipeId: string,
  filename: string,
  cacheControl: string
) {
  const invalidFilename = validateFilename(filename);

  if (invalidFilename) {
    return invalidFilename;
  }

  const stepsDir = path.join(SERVER_CONFIG.UPLOADS_DIR, "recipes", recipeId, "steps");
  const filePath = resolveSafeFilePath(stepsDir, filename);

  if (!filePath) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  try {
    const file = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const type =
      ext === ".png"
        ? "image/png"
        : ext === ".webp"
          ? "image/webp"
          : ext === ".avif"
            ? "image/avif"
            : "image/jpeg";

    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": type,
        "Cache-Control": cacheControl,
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
