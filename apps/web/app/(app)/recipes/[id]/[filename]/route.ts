import { NextResponse } from "next/server";
import { refuseUnlessViewer } from "@/lib/auth/media-session";
import { serveRecipeMedia } from "@/lib/recipe-media";

import { getRecipeOwnerId } from "@norish/db/repositories/recipes";

const VALID_UUID_PATTERN = /^[a-f0-9-]{36}$/i;

export const runtime = "nodejs";

export async function GET(req: Request, { params }: RouteContext<"/recipes/[id]/[filename]">) {
  const { id, filename } = await params;

  // Validate id (should be a UUID)
  if (!id || !VALID_UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Invalid recipe ID" }, { status: 400 });
  }

  const refused = await refuseUnlessViewer(req, () => getRecipeOwnerId(id));

  if (refused) return refused;

  // Every file is named by its content, so a URL never changes meaning;
  // `private` keeps shared caches out, since only the recipe's readers are served.
  return serveRecipeMedia(req, id, filename, "private, max-age=31536000, immutable");
}
