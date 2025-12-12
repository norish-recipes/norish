import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";

import { auth } from "@/server/auth/auth";
import { SERVER_CONFIG } from "./config/env-config-server";

export async function proxy(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session?.user) {
    return NextResponse.next();
  }

  // Invalid or no session - redirect to login
  // Use X-Forwarded headers when behind a reverse proxy
  let loginUrl: URL;
  const origin = request.nextUrl.origin;
  if (SERVER_CONFIG.TRUSTED_ORIGINS.includes(origin)) loginUrl = new URL("/login", `${origin}`);
  else {
    loginUrl = new URL("/login", SERVER_CONFIG.AUTH_URL);
  }

  loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);

  return NextResponse.redirect(loginUrl, 307);
}

export const config = {
  matcher: [
    "/((?!api/auth|api/health|api/trpc|_next|favicon|icons|manifest|robots|login|signup|auth-error|sw.js|.*\\.png|.*\\.ico|.*\\.json|.*\\.webp|.*\\.svg).*)",
  ],
};
