import { serverPackage } from "@/lib/server-package";

const { getActiveRecipeShareByToken } = await serverPackage<
  typeof import("@norish/db/repositories/recipe-shares")
>("@norish/db/repositories/recipe-shares");

export async function getSharedRecipeByToken(token: string) {
  return getActiveRecipeShareByToken(token, { touchLastAccessedAt: true });
}

export function getSharedRecipeMediaCacheControl(): string {
  return "no-store";
}
