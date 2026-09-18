import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

import {
  getIngredientImagesDiskDir,
  INGREDIENT_IMAGE_FILENAME_PATTERN,
} from "@norish/shared-server/media/ingredient-illustration-paths";

export const runtime = "nodejs";

/**
 * Serve an Ingredient Illustration (ADR-0037).
 *
 * Every picture is stored under a filename no earlier picture used, so the
 * bytes behind a URL never change and the response is immutable — the service
 * worker's image cache is correct by construction (ADR-0021). The pictures
 * carry nothing about any household, and a shared recipe read by someone
 * signed out shows them, so the route sits outside the auth proxy and the
 * cache may be public.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ filename: string }> }) {
  const { filename } = await params;

  if (!filename || !INGREDIENT_IMAGE_FILENAME_PATTERN.test(filename)) {
    return NextResponse.json({ error: "Invalid filename" }, { status: 400 });
  }

  const dir = path.resolve(getIngredientImagesDiskDir());
  const filePath = path.resolve(dir, filename);

  if (path.relative(dir, filePath).startsWith("..")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  try {
    const file = await fs.readFile(filePath);

    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": "image/webp",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }
}
