import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

import {
  ownEquipmentIconsDir,
  shippedEquipmentIconsDir,
} from "@norish/shared-server/equipment/icons";
import { ICON_FILE_PATTERN } from "@norish/shared-server/media/ingredient-icon";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: RouteContext<"/equipment-icons/[file]">) {
  const { file } = await params;

  if (!ICON_FILE_PATTERN.test(file)) {
    return NextResponse.json({ error: "Invalid icon" }, { status: 400 });
  }

  for (const dir of [ownEquipmentIconsDir(), shippedEquipmentIconsDir()]) {
    try {
      const bytes = await fs.readFile(path.join(dir, file));

      return new Response(new Uint8Array(bytes), {
        headers: {
          "Content-Type": "image/webp",
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    } catch {
      // Not in this directory; check next.
    }
  }

  return NextResponse.json(
    { error: "Not found" },
    { status: 404, headers: { "Cache-Control": "no-store" } }
  );
}
