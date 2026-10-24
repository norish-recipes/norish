import { NextResponse } from "next/server";
import { refuseUnlessViewer } from "@/lib/auth/media-session";
import { serveRecipeStepMedia } from "@/lib/recipe-media";

import { getRecipeOwnerId } from "@norish/db/repositories/recipes";

export const runtime = "nodejs";

const VALID_UUID_PATTERN = /^[a-f0-9-]{36}$/i;

export async function GET(
  req: Request,
  { params }: RouteContext<"/recipes/[id]/steps/[filename]">
) {
  const { id, filename } = await params;

  // Validate id (should be a UUID)
  if (!id || !VALID_UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Invalid recipe ID" }, { status: 400 });
  }

  const refused = await refuseUnlessViewer(req, () => getRecipeOwnerId(id));

  if (refused) return refused;

  return serveRecipeStepMedia(id, filename, "private, max-age=31536000, immutable");
}
