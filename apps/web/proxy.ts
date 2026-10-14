import { NextRequest, NextResponse } from "next/server";
import { shouldBypassAuthProxy } from "@/lib/recipe-share-access";

import { getVerifiedSession } from "@norish/auth/session";
import { SERVER_CONFIG } from "@norish/config/env-config-server";

export async function proxy(request: NextRequest) {
  // WebSocket upgrade requests should not be redirected - they'll be handled at the app level
  const isWebSocket =
    request.headers.get("upgrade")?.toLowerCase() === "websocket" &&
    request.headers.get("connection")?.toLowerCase().includes("upgrade");

  if (isWebSocket) {
    return NextResponse.next();
  }

  if (shouldBypassAuthProxy(request)) {
    return NextResponse.next();
  }

  const identity = await getVerifiedSession(request.headers);

  if (identity) {
    return NextResponse.next();
  }

  // Invalid, expired, or orphaned session - redirect to login
  // Use X-Forwarded headers when behind a reverse proxy
  const forwardedOrigin = getPublicOrigin(request);
  let loginUrl: URL;

  if (forwardedOrigin && SERVER_CONFIG.TRUSTED_ORIGINS.includes(forwardedOrigin)) {
    loginUrl = new URL("/login", forwardedOrigin);
  } else {
    loginUrl = new URL("/login", SERVER_CONFIG.AUTH_URL);
  }

  loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname + request.nextUrl.search);

  return NextResponse.redirect(loginUrl, 307);
}

function getPublicOrigin(request: NextRequest) {
  const h = request.headers;

  const proto = h.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");

  const host = h.get("x-forwarded-host") ?? h.get("host");

  if (!host) return null;

  return `${proto}://${host}`;
}

export const config = {
  // Each directory is skipped with what is under it and each file exactly, so a
  // future /login-history or /icons-admin still goes through the proxy.
  matcher: [
    "/((?!(?:api/auth|api/trpc|api/v1|trpc|_next|icons|ingredient-icons|brand|login|signup|auth-error|~offline|serwist|sounds)(?:/|$)|(?:manifest\\.webmanifest|sw\\.js|logo\\.svg|logo-small\\.svg|404\\.jpg|nora\\.jpg|robots\\.txt)$).*)",
  ],
};
