import {
  getAverageRating,
  getUserRatingWithVersion,
  rateRecipe,
} from "@norish/db/repositories/ratings";
import { trpcLogger as log } from "@norish/shared-server/logger";
import { accountAudience, recipeAudience } from "@norish/shared-server/realtime/audience";
import { ratings } from "@norish/shared-server/realtime/ratings";
import { RatingGetInputSchema, RatingInputSchema } from "@norish/shared/contracts/zod";

import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";
import { assertRecipeAccess, canViewRecipe } from "../recipes/helpers";

interface UserContext {
  user: { id: string };
}

/** Rating events reach the recipe's own household now, or the actor's once it is gone. */
async function ratingAudience(ctx: UserContext, recipeId: string) {
  return (await recipeAudience(recipeId)) ?? (await accountAudience(ctx.user.id));
}

async function emitRatingFailed(ctx: UserContext, recipeId: string, reason: string): Promise<void> {
  const audience = await ratingAudience(ctx, recipeId);

  if (audience) void ratings.publish("ratingFailed", { recipeId, reason }, audience);
}

const rate = authedProcedure.input(RatingInputSchema).mutation(async ({ ctx, input }) => {
  const { recipeId, rating, version } = input;

  log.debug({ userId: ctx.user.id, recipeId, rating }, "Rating recipe");
  await assertRecipeAccess(ctx, recipeId, "view");

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

      const audience = await ratingAudience(ctx, recipeId);

      if (audience) {
        void ratings.publish(
          "ratingUpdated",
          { recipeId, averageRating: stats.averageRating, ratingCount: stats.ratingCount },
          audience
        );
      }
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
    // A recipe out of view answers as one never rated, as a gone one does.
    const viewable = await canViewRecipe(ctx, input.recipeId);
    const rating = viewable
      ? await getUserRatingWithVersion(ctx.user.id, input.recipeId)
      : { rating: null, version: null };

    return { recipeId: input.recipeId, userRating: rating.rating, version: rating.version };
  });

const getAverage = authedProcedure.input(RatingGetInputSchema).query(async ({ ctx, input }) => {
  const viewable = await canViewRecipe(ctx, input.recipeId);
  const stats = viewable
    ? await getAverageRating(input.recipeId)
    : { averageRating: null, ratingCount: 0 };

  return { recipeId: input.recipeId, ...stats };
});

export const ratingsProcedures = router({
  rate,
  getUserRating: getUserRatingProcedure,
  getAverage,
});
