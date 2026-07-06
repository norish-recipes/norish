import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { ApiReference } from "@scalar/nextjs-api-reference";

import { auth } from "@norish/auth/auth";

export const maxDuration = 300;

const apiReference = ApiReference({
  url: "/api/openapi.json",
  pageTitle: "Norish API",
});

export async function GET(req: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    const loginUrl = new URL("/login", req.url);

    loginUrl.searchParams.set("callbackUrl", "/api/docs");

    return NextResponse.redirect(loginUrl, 307);
  }

  return apiReference(req);
}
