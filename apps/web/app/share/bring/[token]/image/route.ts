import { serveRecipeMedia } from "@/lib/recipe-media";
import { serverPackage } from "@/lib/server-package";

const { readHandoff } = await serverPackage<
  typeof import("@norish/shared-server/bring/handoff-store")
>("@norish/shared-server/bring/handoff-store");

export const runtime = "nodejs";

/** As the handoff page: a 24-byte base64url token, and nothing else is looked up. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;

const notFound = () =>
  new Response(null, {
    status: 404,
    headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" },
  });

/**
 * The recipe's picture for a Bring Handoff, for Bring! to show beside the items. It lives as long
 * as the handoff, under the same token, so the page never names the recipe it came from.
 */
export async function GET(req: Request, { params }: RouteContext<"/share/bring/[token]/image">) {
  const { token } = await params;

  if (!TOKEN_PATTERN.test(token)) return notFound();

  const image = (await readHandoff(token))?.image;

  if (!image || !("file" in image)) return notFound();

  return serveRecipeMedia(req, image.recipeId, image.file, "private, no-store");
}
