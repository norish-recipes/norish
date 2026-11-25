import {
  getAverageRating,
  getUserRatingWithVersion,
  rateRecipe,
} from "@norish/db/repositories/ratings";
import { getRecipeHouseholdId } from "@norish/db/repositories/recipes";
import { getRecipePermissionPolicy } from "@norish/shared-server/config/server-config-loader";
import { trpcLogger as log } from "@norish/shared-server/logger";
import { ratings } from "@norish/shared-server/realtime/ratings";
import { RatingGetInputSchema, RatingInputSchema } from "@norish/shared/contracts/zod";

import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";

interface UserContext {
  user: { id: string };
  householdId: string;
}

/** Rating events reach the recipe's own household, or the actor's when it is gone. */
async function ratingAudience(ctx: UserContext, recipeId: string) {
  const policy = await getRecipePermissionPolicy();

  return {
    viewPolicy: policy.view,
    householdId: (await getRecipeHouseholdId(recipeId)) ?? ctx.householdId,
  };
}

async function emitRatingFailed(ctx: UserContext, recipeId: string, reason: string): Promise<void> {
  void ratings.publish("ratingFailed", { recipeId, reason }, await ratingAudience(ctx, recipeId));
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

      log.info(
        { userId: ctx.user.id, recipeId, rating, isNew: result.isNew },
        rating === null ? "Recipe rating removed" : "Recipe rated"
      );

      void ratings.publish(
        "ratingUpdated",
        { recipeId, averageRating: stats.averageRating, ratingCount: stats.ratingCount },
        await ratingAudience(ctx, recipeId)
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
