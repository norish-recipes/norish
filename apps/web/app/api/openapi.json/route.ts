import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { auth } from "@norish/auth/auth";
import { getOpenApiDocument } from "@norish/trpc/server";

export const maxDuration = 300;

function getBaseUrl(req: Request) {
  const url = new URL(req.url);
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const forwardedHost = req.headers.get("x-forwarded-host");
  const protocol = forwardedProto ?? url.protocol.replace(":", "");
  const host = forwardedHost ?? req.headers.get("host") ?? url.host;

  return `${protocol}://${host}`;
}

export async function GET(req: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json(getOpenApiDocument(getBaseUrl(req)), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
