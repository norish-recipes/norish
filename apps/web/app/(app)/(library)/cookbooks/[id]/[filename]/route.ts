import { NextResponse } from "next/server";
import { refuseUnlessViewer } from "@/lib/auth/media-session";
import { serveCookbookMedia } from "@/lib/recipe-media";
import { serverPackage } from "@/lib/server-package";

import { mediaId } from "@norish/shared/lib/recipe-media";

const { getCookbookRow } = await serverPackage<typeof import("@norish/db/repositories/cookbooks")>(
  "@norish/db/repositories/cookbooks"
);

export const runtime = "nodejs";

export async function GET(req: Request, { params }: RouteContext<"/cookbooks/[id]/[filename]">) {
  const { id, filename } = await params;

  // Only the database's spelling of the id: another reaches the same folder on some disks.
  if (mediaId(id) !== id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const refused = await refuseUnlessViewer(
    req,
    async () => (await getCookbookRow(id))?.householdId ?? null
  );

  if (refused) return refused;

  // Every upload is named by its content hash, so a URL never changes meaning;
  // `private` keeps shared caches out, since only the cookbook's readers are served.
  return serveCookbookMedia(req, id, filename, "private, max-age=31536000, immutable");
}
