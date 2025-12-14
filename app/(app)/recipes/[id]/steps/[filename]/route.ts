import fs from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { SERVER_CONFIG } from "@/config/env-config-server";

export const runtime = "nodejs";

const VALID_FILENAME_PATTERN = /^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/;
const VALID_UUID_PATTERN = /^[a-f0-9-]{36}$/i;

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

  const stepsDir = path.join(SERVER_CONFIG.UPLOADS_DIR, "recipes", id, "steps");
  const filePath = path.join(stepsDir, filename);

  // Verify we're still within the expected directory (prevent path traversal)
  const resolvedPath = path.resolve(filePath);
  const resolvedDir = path.resolve(stepsDir);
  const relative = path.relative(resolvedDir, resolvedPath);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
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
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (_error) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
