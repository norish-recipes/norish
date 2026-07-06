import { NextResponse } from "next/server";
import { serveRecipeStepMedia } from "@/lib/recipe-media";

export const runtime = "nodejs";

const VALID_UUID_PATTERN = /^[a-f0-9-]{36}$/i;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string; filename: string }> }
) {
  const { id, filename } = await params;

  // Validate id (should be a UUID)
  if (!id || !VALID_UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: "Invalid recipe ID" }, { status: 400 });
  }

  return serveRecipeStepMedia(id, filename, "public, max-age=31536000, immutable");
}
