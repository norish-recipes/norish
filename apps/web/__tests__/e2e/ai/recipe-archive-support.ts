import { expect } from "@playwright/test";

import { removeRating } from "@norish/db/repositories/ratings";

import type { AIE2EStack } from "./fixture";
import { userIdOf } from "../harness/accounts";
import { readRecipe, recipeIdsNamed } from "../harness/recipes";
import { callTrpc, queryTrpc } from "../harness/trpc";
import { OWNER } from "./fixture";

type Owner = Pick<AIE2EStack, "baseURL" | "ownerCookies">;

export interface StoredRecipe {
  id: string;
  userId: string | null;
  /** Gallery image web paths, in order */
  images: string[];
}

/**
 * Every stored recipe carrying this name. More than one row is a duplicate —
 * exactly what overwrite-on-match promises not to produce.
 */
export async function readStoredRecipes(stack: Owner, name: string): Promise<StoredRecipe[]> {
  const recipes = await Promise.all(
    (await recipeIdsNamed(name)).map((id) => readRecipe(stack.baseURL, stack.ownerCookies, id))
  );

  return recipes.flatMap((recipe) =>
    recipe
      ? [{ id: recipe.id, userId: recipe.userId, images: recipe.images.map(({ image }) => image) }]
      : []
  );
}

export interface RecipeMarks {
  rating: number | null;
  favorite: boolean;
}

/** The owner's own rating and favourite on a recipe. */
export async function readMarks(stack: Owner, recipeId: string): Promise<RecipeMarks> {
  const [{ userRating }, { isFavorite }] = await Promise.all([
    queryTrpc<{ userRating: number | null }>(
      stack.baseURL,
      stack.ownerCookies,
      "ratings.getUserRating",
      { recipeId }
    ),
    queryTrpc<{ isFavorite: boolean }>(stack.baseURL, stack.ownerCookies, "favorites.check", {
      recipeId,
    }),
  ]);

  return { rating: userRating, favorite: isFavorite };
}

/** Mark a recipe as the owner, so the marks have something to travel with. */
export async function applyMarks(stack: Owner, recipeId: string, rating: number): Promise<void> {
  await callTrpc(stack.baseURL, stack.ownerCookies, "ratings.rate", { recipeId, rating });
  await setFavorite(stack, recipeId, true);
  // The rating is written after the mutation answers.
  await expect.poll(async () => (await readMarks(stack, recipeId)).rating).toBe(rating);
}

/** Wipe the marks between export and reimport; the app can't take a rating back, so the repository does. */
export async function clearMarks(stack: Owner, recipeId: string): Promise<void> {
  await removeRating(await userIdOf(OWNER), recipeId);
  await setFavorite(stack, recipeId, false);
}

async function setFavorite(stack: Owner, recipeId: string, isFavorite: boolean): Promise<void> {
  await callTrpc(stack.baseURL, stack.ownerCookies, "favorites.toggle", { recipeId, isFavorite });
}
