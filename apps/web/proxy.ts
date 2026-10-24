import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { DESTINATION_HEADER, loginPath } from "@/lib/auth/login-redirect";

import { hasCredential } from "@norish/auth/credentials";
import { SERVER_CONFIG } from "@norish/config/env-config-server";

/**
 * An optimistic check, as Next intends a proxy's to be: a request without a
 * session cookie or API key goes to the login page, and one with either goes
 * on. It reads no session and no database, so a page's skeleton and a grid of
 * images start loading at once; the signed-in layout, the media routes and
 * tRPC check the session behind the credential.
 */
export function proxy(request: NextRequest) {
  const destination = request.nextUrl.pathname + request.nextUrl.search;

  if (hasCredential(request.headers)) {
    const headers = new Headers(request.headers);

    headers.set(DESTINATION_HEADER, destination);

    return NextResponse.next({ request: { headers } });
  }

  return NextResponse.redirect(new URL(loginPath(destination), loginOrigin(request)), 307);
}

/** The public origin, from the X-Forwarded headers when a trusted reverse proxy sets them. */
function loginOrigin(request: NextRequest): string {
  const h = request.headers;
  const proto = h.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const forwarded = host ? `${proto}://${host}` : null;

  return forwarded && SERVER_CONFIG.TRUSTED_ORIGINS.includes(forwarded)
    ? forwarded
    : SERVER_CONFIG.AUTH_URL;
}

export const config = {
  // Each directory is skipped with what is under it and each file exactly, so a
  // future /login-history or /icons-admin still goes through the proxy. Shared
  // recipes (/share) check their own share token.
  matcher: [
    "/((?!(?:api/auth|api/trpc|api/v1|trpc|_next|icons|ingredient-icons|equipment-icons|brand|login|signup|auth-error|share|~offline|serwist|sounds)(?:/|$)|(?:manifest\\.webmanifest|sw\\.js|logo\\.svg|logo-small\\.svg|404\\.jpg|nora\\.jpg|robots\\.txt)$).*)",
  ],
};
