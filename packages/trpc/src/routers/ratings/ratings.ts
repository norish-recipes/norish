import { getRecipePermissionPolicy } from "@norish/config/server-config-loader";
import {
  getAverageRating,
  getUserRatingWithVersion,
  rateRecipe,
} from "@norish/db/repositories/ratings";
import { trpcLogger as log } from "@norish/shared-server/logger";
import { RatingGetInputSchema, RatingInputSchema } from "@norish/shared/contracts/zod";

import { emitByPolicy } from "../../helpers";
import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";
import { ratingsEmitter } from "./emitter";

interface UserContext {
  user: { id: string };
  householdKey: string;
}

async function emitRatingFailed(ctx: UserContext, recipeId: string, reason: string): Promise<void> {
  const policy = await getRecipePermissionPolicy();

  emitByPolicy(
    ratingsEmitter,
    policy.view,
    { userId: ctx.user.id, householdKey: ctx.householdKey },
    "ratingFailed",
    { recipeId, reason }
  );
}

const rate = authedProcedure.input(RatingInputSchema).mutation(({ ctx, input }) => {
  const { recipeId, rating, version } = input;

  log.debug({ userId: ctx.user.id, recipeId, rating }, "Rating recipe");

  rateRecipe(ctx.user.id, recipeId, rating, version)
    .then(async (result) => {
      if (result.stale) {
        log.info({ userId: ctx.user.id, recipeId, version }, "Ignoring stale rating mutation");

        return;
      }

      const stats = await getAverageRating(recipeId);
      const policy = await getRecipePermissionPolicy();

      log.info({ userId: ctx.user.id, recipeId, rating, isNew: result.isNew }, "Recipe rated");

      emitByPolicy(
        ratingsEmitter,
        policy.view,
        { userId: ctx.user.id, householdKey: ctx.householdKey },
        "ratingUpdated",
        { recipeId, averageRating: stats.averageRating, ratingCount: stats.ratingCount }
      );
    })
    .catch((err) => {
      const error = err as Error;

      log.error({ err: error, userId: ctx.user.id, recipeId }, "Failed to rate recipe");
      emitRatingFailed(ctx, recipeId, error.message || "Failed to rate recipe");
    });

  return { success: true };
});

const getUserRatingProcedure = authedProcedure
  .input(RatingGetInputSchema)
  .query(async ({ ctx, input }) => {
    const rating = await getUserRatingWithVersion(ctx.user.id, input.recipeId);

    return { recipeId: input.recipeId, userRating: rating.rating, version: rating.version };
  });

const getAverage = authedProcedure.input(RatingGetInputSchema).query(async ({ input }) => {
  const stats = await getAverageRating(input.recipeId);

  return { recipeId: input.recipeId, ...stats };
});

export const ratingsProcedures = router({
  rate,
  getUserRating: getUserRatingProcedure,
  getAverage,
});
