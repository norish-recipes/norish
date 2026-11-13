import { NextResponse } from "next/server";
import { refuseUnlessViewer } from "@/lib/auth/media-session";
import { serveCookbookMedia } from "@/lib/recipe-media";

import { getCookbookRow } from "@norish/db/repositories/cookbooks";

const VALID_UUID_PATTERN = /^[a-f0-9-]{36}$/i;

export const runtime = "nodejs";

export async function GET(req: Request, { params }: RouteContext<"/cookbooks/[id]/[filename]">) {
  const { id, filename } = await params;

  if (!id || !VALID_UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Invalid cookbook ID" }, { status: 400 });
  }

  const refused = await refuseUnlessViewer(
    req,
    async () => (await getCookbookRow(id))?.userId ?? null
  );

  if (refused) return refused;

  // Every upload is named by its content hash, so a URL never changes meaning;
  // `private` keeps shared caches out, since only the cookbook's readers are served.
  return serveCookbookMedia(req, id, filename, "private, max-age=31536000, immutable");
}
