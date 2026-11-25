import { NextResponse } from "next/server";
import { refuseUnlessViewer } from "@/lib/auth/media-session";
import { serveRecipeStepMedia } from "@/lib/recipe-media";
import { serverPackage } from "@/lib/server-package";

const { getRecipeHouseholdIds } = await serverPackage<
  typeof import("@norish/db/repositories/recipes")
>("@norish/db/repositories/recipes");
const { pendingRecipeMediaUploader } = await serverPackage<
  typeof import("@norish/shared-server/media/pending-recipe-media")
>("@norish/shared-server/media/pending-recipe-media");

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

  const refused = await refuseUnlessViewer(
    req,
    async () => (await getRecipeHouseholdIds([id])).get(id) ?? null,
    () => pendingRecipeMediaUploader(id)
  );

  if (refused) return refused;

  return serveRecipeStepMedia(id, filename, "private, max-age=31536000, immutable");
}
