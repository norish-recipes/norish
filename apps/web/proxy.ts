import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { shouldBypassAuthProxy } from "@/lib/recipe-share-access";

import { auth } from "@norish/auth/auth";
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

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session?.user) {
    return NextResponse.next();
  }

  // Invalid or no session - redirect to login
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
  matcher: [
    "/((?!api/auth|api/trpc|api/v1|trpc|_next|icons|images/splash|login|signup|auth-error|sw\\.js|favicon\\.ico|favicon\\.svg|favicon-16x16\\.png|favicon-32x32\\.png|favicon-96x96\\.png|apple-touch-icon\\.png|android-chrome-192x192\\.png|android-chrome-512x512\\.png|web-app-manifest-192x192\\.png|web-app-manifest-512x512\\.png|site\\.webmanifest|logo\\.svg|404\\.jpg|nora\\.jpg|mockup-norish\\.png|robots|sounds/).*)",
  ],
};
