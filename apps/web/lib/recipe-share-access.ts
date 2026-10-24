import { getActiveRecipeShareByToken } from "@norish/db/repositories/recipe-shares";

export async function getSharedRecipeByToken(token: string) {
  return getActiveRecipeShareByToken(token, { touchLastAccessedAt: true });
}

export function getSharedRecipeMediaCacheControl(): string {
  return "no-store";
}
