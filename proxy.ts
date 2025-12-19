import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";

import { SERVER_CONFIG } from "./config/env-config-server";

import { auth } from "@/server/auth/auth";

export async function proxy(request: NextRequest) {
  // WebSocket upgrade requests should not be redirected - they'll be handled at the app level
  const isWebSocket =
    request.headers.get("upgrade")?.toLowerCase() === "websocket" &&
    request.headers.get("connection")?.toLowerCase().includes("upgrade");

  if (isWebSocket) {
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
    "/((?!api/auth|api/health|api/trpc|trpc|_next|favicon|icons|manifest|robots|login|signup|auth-error|sw.js|.*\\.png|.*\\.ico|.*\\.json|.*\\.webp|.*\\.svg).*)",
  ],
};
