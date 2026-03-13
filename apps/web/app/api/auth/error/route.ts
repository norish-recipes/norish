import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const error = searchParams.get("error") || "unknown";

  const redirectUrl = new URL("/auth-error", request.url);

  redirectUrl.searchParams.set("error", error);

  return NextResponse.redirect(redirectUrl);
}
