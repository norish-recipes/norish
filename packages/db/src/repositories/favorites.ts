import { and, eq, inArray } from "drizzle-orm";

import { db } from "@norish/db/drizzle";

import type { MutationOutcome } from "./mutation-outcomes";
import type { RecipeListContext } from "./recipes";
import { recipeFavorites, recipes } from "../schema";
import { appliedOutcome, staleOutcome } from "./mutation-outcomes";
import { buildPolicyCondition } from "./recipes";

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

export async function setFavorite(
  userId: string,
  recipeId: string,
  isFavorite: boolean,
  version?: number
): Promise<MutationOutcome<{ isFavorite: boolean }>> {
  if (isFavorite) {
    await addFavorite(userId, recipeId);

    return appliedOutcome({ isFavorite: true });
  }

  const whereConditions = [
    eq(recipeFavorites.userId, userId),
    eq(recipeFavorites.recipeId, recipeId),
  ];

  if (version) {
    whereConditions.push(eq(recipeFavorites.version, version));
  }

  const deleted = await db
    .delete(recipeFavorites)
    .where(and(...whereConditions))
    .returning({ recipeId: recipeFavorites.recipeId });

  if (deleted.length === 0 && version) {
    return staleOutcome({ isFavorite: false });
  }

  return appliedOutcome({ isFavorite: false });
}

/** The reader's favourites they may view now; one out of view comes back when the policy widens. */
export async function getFavoriteRecipesWithVersions(
  viewer: RecipeListContext
): Promise<Array<{ recipeId: string; version: number }>> {
  return await db
    .select({ recipeId: recipeFavorites.recipeId, version: recipeFavorites.version })
    .from(recipeFavorites)
    .innerJoin(recipes, eq(recipes.id, recipeFavorites.recipeId))
    .where(
      and(
        eq(recipeFavorites.userId, viewer.userId),
        await buildPolicyCondition(viewer, recipes.householdId, "view")
      )
    );
}

/** Which of these recipes the reader favourited and may view now. */
export async function getFavoritesByRecipeIds(
  viewer: RecipeListContext,
  recipeIds: string[]
): Promise<Set<string>> {
  if (recipeIds.length === 0) return new Set();

  const results = await db
    .select({ recipeId: recipeFavorites.recipeId })
    .from(recipeFavorites)
    .innerJoin(recipes, eq(recipes.id, recipeFavorites.recipeId))
    .where(
      and(
        eq(recipeFavorites.userId, viewer.userId),
        inArray(recipeFavorites.recipeId, recipeIds),
        await buildPolicyCondition(viewer, recipes.householdId, "view")
      )
    );

  return new Set(results.map((r) => r.recipeId));
}
