import { serverPackage } from "@/lib/server-package";

const { readHandoff } = await serverPackage<
  typeof import("@norish/shared-server/bring/handoff-store")
>("@norish/shared-server/bring/handoff-store");
const { renderHandoffHtml } = await serverPackage<
  typeof import("@norish/shared-server/bring/recipe-markup")
>("@norish/shared-server/bring/recipe-markup");
const { publicBaseUrl } = await serverPackage<
  typeof import("@norish/shared-server/bring/public-url")
>("@norish/shared-server/bring/public-url");

export const runtime = "nodejs";

/** What a Bring Handoff token looks like: 24 random bytes in base64url. Anything else is not looked up. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32}$/;

/** The same for a page and a miss, so a miss tells nothing a hit would not. */
const PRIVATE_HEADERS = {
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy": "default-src 'none'",
  "X-Content-Type-Options": "nosniff",
};

const notFound = () => new Response(null, { status: 404, headers: PRIVATE_HEADERS });

/**
 * The page Bring!'s servers fetch for a Bring Handoff: a schema.org Recipe holding only a title and
 * item lines. It has no session; the unguessable token is its only check, and it expires in an hour.
 */
export async function GET(_req: Request, { params }: RouteContext<"/share/bring/[token]">) {
  const { token } = await params;

  // A malformed token never reaches Valkey.
  if (!TOKEN_PATTERN.test(token)) return notFound();

  const handoff = await readHandoff(token);

  if (!handoff) return notFound();

  return new Response(renderHandoffHtml(handoff, { baseUrl: publicBaseUrl(), token }), {
    headers: { "Content-Type": "text/html; charset=utf-8", ...PRIVATE_HEADERS },
  });
}
