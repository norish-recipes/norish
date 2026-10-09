import { NextResponse } from "next/server";
import { serveCookbookMedia } from "@/lib/recipe-media";

const VALID_UUID_PATTERN = /^[a-f0-9-]{36}$/i;

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; filename: string }> }
) {
  const { id, filename } = await params;

  if (!id || !VALID_UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Invalid cookbook ID" }, { status: 400 });
  }

  // Every upload is named by its content hash, so a URL never changes meaning.
  return serveCookbookMedia(req, id, filename, "public, max-age=31536000, immutable");
}
