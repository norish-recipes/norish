import {
  getAverageRating,
  getUserRatingWithVersion,
  rateRecipe,
} from "@norish/db/repositories/ratings";
import { getRecipePermissionPolicy } from "@norish/shared-server/config/server-config-loader";
import { trpcLogger as log } from "@norish/shared-server/logger";
import { appliedAck, mutationAckSchema, staleAck } from "@norish/shared/contracts";
import { RatingGetInputSchema, RatingInputSchema } from "@norish/shared/contracts/zod";

import { emitByPolicy } from "../../helpers";
import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";
import { ratingsEmitter } from "./emitter";

const rate = authedProcedure
  .input(RatingInputSchema)
  .output(mutationAckSchema)
  .mutation(async ({ ctx, input }) => {
    const { recipeId, rating, version } = input;

    log.debug({ userId: ctx.user.id, recipeId, rating }, "Rating recipe");

    try {
      const result = await rateRecipe(ctx.user.id, recipeId, rating, version);

      if (result.stale) {
        log.info({ userId: ctx.user.id, recipeId, version }, "Ignoring stale rating mutation");

        return staleAck();
      }

      const stats = await getAverageRating(recipeId);
      const policy = await getRecipePermissionPolicy();

      log.info({ userId: ctx.user.id, recipeId, rating, isNew: result.isNew }, "Recipe rated");

      await emitByPolicy(
        ratingsEmitter,
        policy.view,
        { userId: ctx.user.id, householdKey: ctx.householdKey },
        "ratingUpdated",
        { recipeId, averageRating: stats.averageRating, ratingCount: stats.ratingCount }
      );

      return appliedAck();
    } catch (err) {
      log.error({ err, userId: ctx.user.id, recipeId }, "Failed to rate recipe");
      throw err;
    }
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
