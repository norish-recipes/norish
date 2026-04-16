import {
  getFavoriteRecipesWithVersions,
  getFavoritesByRecipeIds,
  isFavorite,
  setFavorite,
} from "@norish/db/repositories/favorites";
import { trpcLogger as log } from "@norish/shared-server/logger";
import {
  FavoriteBatchCheckInputSchema,
  FavoriteCheckInputSchema,
  FavoriteSetInputSchema,
} from "@norish/shared/contracts/zod";

import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";

const toggle = authedProcedure.input(FavoriteSetInputSchema).mutation(async ({ ctx, input }) => {
  const { recipeId, isFavorite: desiredState, version } = input;

  log.debug({ userId: ctx.user.id, recipeId, isFavorite: desiredState }, "Setting recipe favorite");

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

  const result = await isFavorite(ctx.user.id, recipeId);

  return { recipeId, isFavorite: result };
});

const list = authedProcedure.query(async ({ ctx }) => {
  log.debug({ userId: ctx.user.id }, "Getting favorite recipe IDs");

  const favorites = await getFavoriteRecipesWithVersions(ctx.user.id);

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

    const favoritesSet = await getFavoritesByRecipeIds(ctx.user.id, recipeIds);

    return { favoriteIds: Array.from(favoritesSet) };
  });

export const favoritesProcedures = router({
  toggle,
  check,
  list,
  batchCheck,
});
