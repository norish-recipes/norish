import type { NextRequest } from "next/server";

import { getActiveRecipeShareByToken } from "@norish/db/repositories/recipe-shares";

export function isRecipeSharePagePath(pathname: string): boolean {
  return pathname.startsWith("/share/");
}

export function shouldBypassAuthProxy(request: NextRequest): boolean {
  return isRecipeSharePagePath(request.nextUrl.pathname);
}

export async function getSharedRecipeByToken(token: string) {
  return getActiveRecipeShareByToken(token, { touchLastAccessedAt: true });
}

export function getSharedRecipeMediaCacheControl(): string {
  return "no-store";
}
