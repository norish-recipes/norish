import {
  getFavoriteRecipesWithVersions,
  getFavoritesByRecipeIds,
  setFavorite,
} from "@norish/db/repositories/favorites";
import { trpcLogger as log } from "@norish/shared-server/logger";
import {
  FavoriteBatchCheckInputSchema,
  FavoriteCheckInputSchema,
  FavoriteSetInputSchema,
} from "@norish/shared/contracts/zod";

import { authedProcedure, viewerOf } from "../../middleware";
import { router } from "../../trpc";
import { assertRecipeAccess } from "../recipes/helpers";

const toggle = authedProcedure.input(FavoriteSetInputSchema).mutation(async ({ ctx, input }) => {
  const { recipeId, isFavorite: desiredState, version } = input;

  log.debug({ userId: ctx.user.id, recipeId, isFavorite: desiredState }, "Setting recipe favorite");

  // Only what the reader may view; one out of view answers as one that is gone.
  await assertRecipeAccess(ctx, recipeId, "view");

  const result = await setFavorite(ctx.user.id, recipeId, desiredState, version);

  if (result.stale) {
    log.info({ userId: ctx.user.id, recipeId, version }, "Ignoring stale favorite mutation");

    return { recipeId, isFavorite: desiredState, stale: true };
  }

  log.info({ userId: ctx.user.id, recipeId, isFavorite: result.value.isFavorite }, "Favorite set");

  return { recipeId, isFavorite: result.value.isFavorite, stale: false };
});

const check = authedProcedure.input(FavoriteCheckInputSchema).query(async ({ ctx, input }) => {
  const { recipeId } = input;

  log.debug({ userId: ctx.user.id, recipeId }, "Checking if recipe is favorite");

  const result = await getFavoritesByRecipeIds(viewerOf(ctx), [recipeId]);

  return { recipeId, isFavorite: result.has(recipeId) };
});

const list = authedProcedure.query(async ({ ctx }) => {
  log.debug({ userId: ctx.user.id }, "Getting favorite recipe IDs");

  const favorites = await getFavoriteRecipesWithVersions(viewerOf(ctx));

  return {
    favoriteIds: favorites.map((favorite) => favorite.recipeId),
    favoriteVersions: Object.fromEntries(
      favorites.map((favorite) => [favorite.recipeId, favorite.version])
    ),
  };
});

const batchCheck = authedProcedure
  .input(FavoriteBatchCheckInputSchema)
  .query(async ({ ctx, input }) => {
    const { recipeIds } = input;

    if (recipeIds.length === 0) {
      return { favoriteIds: [] as string[] };
    }

    log.debug({ userId: ctx.user.id, count: recipeIds.length }, "Batch checking recipe favorites");

    const favoritesSet = await getFavoritesByRecipeIds(viewerOf(ctx), recipeIds);

    return { favoriteIds: Array.from(favoritesSet) };
  });

export const favoritesProcedures = router({
  toggle,
  check,
  list,
  batchCheck,
});
