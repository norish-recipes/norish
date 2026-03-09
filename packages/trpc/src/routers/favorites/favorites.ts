import {
  getFavoriteRecipeIds,
  getFavoritesByRecipeIds,
  isFavorite,
  toggleFavorite,
} from "@norish/db/repositories/favorites";
import { trpcLogger as log } from "@norish/shared-server/logger";
import {
  FavoriteBatchCheckInputSchema,
  FavoriteCheckInputSchema,
  FavoriteToggleInputSchema,
} from "@norish/shared/contracts/zod";

import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";

const toggle = authedProcedure.input(FavoriteToggleInputSchema).mutation(async ({ ctx, input }) => {
  const { recipeId } = input;

  log.debug({ userId: ctx.user.id, recipeId }, "Toggling recipe favorite");

  const result = await toggleFavorite(ctx.user.id, recipeId);

  log.info({ userId: ctx.user.id, recipeId, isFavorite: result.isFavorite }, "Favorite toggled");

  return { recipeId, isFavorite: result.isFavorite };
});

const check = authedProcedure.input(FavoriteCheckInputSchema).query(async ({ ctx, input }) => {
  const { recipeId } = input;

  log.debug({ userId: ctx.user.id, recipeId }, "Checking if recipe is favorite");

  const result = await isFavorite(ctx.user.id, recipeId);

  return { recipeId, isFavorite: result };
});

const list = authedProcedure.query(async ({ ctx }) => {
  log.debug({ userId: ctx.user.id }, "Getting favorite recipe IDs");

  const favoriteIds = await getFavoriteRecipeIds(ctx.user.id);

  return { favoriteIds };
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
