import { and, eq, inArray } from "drizzle-orm";

import { db } from "../drizzle";
import { recipeFavorites } from "../schema";

export async function addFavorite(userId: string, recipeId: string): Promise<void> {
  await db
    .insert(recipeFavorites)
    .values({ userId, recipeId })
    .onConflictDoNothing({ target: [recipeFavorites.userId, recipeFavorites.recipeId] });
}

export async function removeFavorite(userId: string, recipeId: string): Promise<void> {
  await db
    .delete(recipeFavorites)
    .where(and(eq(recipeFavorites.userId, userId), eq(recipeFavorites.recipeId, recipeId)));
}

export async function toggleFavorite(
  userId: string,
  recipeId: string
): Promise<{ isFavorite: boolean }> {
  const existing = await db
    .select({ id: recipeFavorites.id })
    .from(recipeFavorites)
    .where(and(eq(recipeFavorites.userId, userId), eq(recipeFavorites.recipeId, recipeId)))
    .limit(1);

  if (existing.length > 0) {
    await removeFavorite(userId, recipeId);

    return { isFavorite: false };
  } else {
    await addFavorite(userId, recipeId);

    return { isFavorite: true };
  }
}

export async function isFavorite(userId: string, recipeId: string): Promise<boolean> {
  const result = await db
    .select({ id: recipeFavorites.id })
    .from(recipeFavorites)
    .where(and(eq(recipeFavorites.userId, userId), eq(recipeFavorites.recipeId, recipeId)))
    .limit(1);

  return result.length > 0;
}

export async function getFavoriteRecipeIds(userId: string): Promise<string[]> {
  const results = await db
    .select({ recipeId: recipeFavorites.recipeId })
    .from(recipeFavorites)
    .where(eq(recipeFavorites.userId, userId));

  return results.map((r) => r.recipeId);
}

export async function getFavoritesByRecipeIds(
  userId: string,
  recipeIds: string[]
): Promise<Set<string>> {
  if (recipeIds.length === 0) return new Set();

  const results = await db
    .select({ recipeId: recipeFavorites.recipeId })
    .from(recipeFavorites)
    .where(and(eq(recipeFavorites.userId, userId), inArray(recipeFavorites.recipeId, recipeIds)));

  return new Set(results.map((r) => r.recipeId));
}
