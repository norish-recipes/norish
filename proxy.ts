import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";

import { auth } from "@/server/auth/auth";

export async function proxy(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session?.user) {
    return NextResponse.next();
  }

  // Invalid or no session - redirect to login
  const loginUrl = new URL("/login", request.url);

  loginUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);

  return NextResponse.redirect(loginUrl, 307);
}

export const config = {
  matcher: [
    "/((?!api/auth|api/health|api/trpc|_next|favicon|icons|manifest|robots|login|signup|auth-error|sw.js|.*\\.png|.*\\.ico|.*\\.json|.*\\.webp|.*\\.svg).*)",
  ],
};
