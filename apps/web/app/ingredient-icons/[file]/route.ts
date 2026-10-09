import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

import {
  ICON_FILE_PATTERN,
  iconSetDir,
  ownIconsDir,
} from "@norish/shared-server/media/ingredient-icon";

export const runtime = "nodejs";

/**
 * Ingredient Icons, own and shipped, at one address each. A file is named for
 * its content, so the bytes behind an address never change and every cache
 * may keep them for good (ADR-0021). An icon is a generic picture of a food
 * and carries no household's data, so the route sits outside the auth proxy
 * and a shared recipe read signed out shows its icons too.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;

  if (!ICON_FILE_PATTERN.test(file)) {
    return NextResponse.json({ error: "Invalid icon" }, { status: 400 });
  }

  for (const dir of [ownIconsDir(), path.join(iconSetDir(), "icons")]) {
    try {
      const bytes = await fs.readFile(path.join(dir, file));

      return new Response(new Uint8Array(bytes), {
        headers: {
          "Content-Type": "image/webp",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    } catch {
      // Not in this one: an own icon, or a shipped one.
    }
  }

  return NextResponse.json(
    { error: "Not found" },
    { status: 404, headers: { "Cache-Control": "no-store" } }
  );
}
