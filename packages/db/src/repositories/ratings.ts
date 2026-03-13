import { and, avg, count, eq } from "drizzle-orm";

import { db } from "../drizzle";
import { recipeRatings } from "../schema";

export interface RatingStats {
  averageRating: number | null;
  ratingCount: number;
}

export async function rateRecipe(
  userId: string,
  recipeId: string,
  rating: number
): Promise<{ rating: number; isNew: boolean }> {
  const existing = await db
    .select({ id: recipeRatings.id })
    .from(recipeRatings)
    .where(and(eq(recipeRatings.userId, userId), eq(recipeRatings.recipeId, recipeId)))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(recipeRatings)
      .set({ rating, updatedAt: new Date() })
      .where(and(eq(recipeRatings.userId, userId), eq(recipeRatings.recipeId, recipeId)));

    return { rating, isNew: false };
  }

  await db.insert(recipeRatings).values({ userId, recipeId, rating });

  return { rating, isNew: true };
}

export async function getUserRating(userId: string, recipeId: string): Promise<number | null> {
  const result = await db
    .select({ rating: recipeRatings.rating })
    .from(recipeRatings)
    .where(and(eq(recipeRatings.userId, userId), eq(recipeRatings.recipeId, recipeId)))
    .limit(1);

  return result[0]?.rating ?? null;
}

export async function getAverageRating(recipeId: string): Promise<RatingStats> {
  const result = await db
    .select({
      averageRating: avg(recipeRatings.rating),
      ratingCount: count(recipeRatings.id),
    })
    .from(recipeRatings)
    .where(eq(recipeRatings.recipeId, recipeId));

  const row = result[0];

  return {
    averageRating: row?.averageRating ? parseFloat(row.averageRating) : null,
    ratingCount: Number(row?.ratingCount ?? 0),
  };
}
