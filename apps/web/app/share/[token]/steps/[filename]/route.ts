import { NextResponse } from "next/server";
import { serveRecipeStepMedia } from "@/lib/recipe-media";
import {
  getSharedRecipeByToken,
  getSharedRecipeMediaCacheControl,
} from "@/lib/recipe-share-access";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string; filename: string }> }
) {
  const { token, filename } = await params;

  if (!token?.trim()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const share = await getSharedRecipeByToken(token);

  if (!share) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return serveRecipeStepMedia(share.recipeId, filename, getSharedRecipeMediaCacheControl());
}
