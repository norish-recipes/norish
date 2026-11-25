import { NextResponse } from "next/server";
import { refuseUnlessViewer } from "@/lib/auth/media-session";
import { serveRecipeStepMedia } from "@/lib/recipe-media";
import { serverPackage } from "@/lib/server-package";

import { mediaId } from "@norish/shared/lib/recipe-media";

const { getRecipeHouseholdIds } = await serverPackage<
  typeof import("@norish/db/repositories/recipes")
>("@norish/db/repositories/recipes");
const { pendingRecipeMediaUploader } = await serverPackage<
  typeof import("@norish/shared-server/media/pending-recipe-media")
>("@norish/shared-server/media/pending-recipe-media");

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: RouteContext<"/recipes/[id]/steps/[filename]">
) {
  const { id, filename } = await params;

  // Only the database's spelling of the id: another reaches the same folder on some disks.
  if (mediaId(id) !== id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const refused = await refuseUnlessViewer(
    req,
    async () => (await getRecipeHouseholdIds([id])).get(id) ?? null,
    () => pendingRecipeMediaUploader(id)
  );

  if (refused) return refused;

  return serveRecipeStepMedia(id, filename, "private, max-age=31536000, immutable");
}
