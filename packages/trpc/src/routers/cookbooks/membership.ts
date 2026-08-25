import { z } from "zod";

import type { FilterMode, SortOrder } from "@norish/shared/contracts";
import {
  addRecipeToCookbook,
  listCookbooksForRecipe,
  listEditableCookbooks,
  removeRecipeFromCookbook,
} from "@norish/db/repositories/cookbooks";
import { listRecipes } from "@norish/db/repositories/recipes";
import { trpcLogger as log } from "@norish/shared-server/logger";
import {
  CookbookForRecipeInputSchema,
  CookbookMembershipInputSchema,
  CookbookRecipesInputSchema,
  CookbookSummarySchema,
  RecipeListResultSchema,
} from "@norish/shared/contracts/zod";

import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";
import { assertRecipeAccess } from "../recipes/helpers";
import { assertCookbookAccess, emitCookbookEvent, listContextFor } from "./helpers";

/**
 * File a recipe into a cookbook, or take it out again.
 *
 * The rule is view on the recipe and edit on the cookbook, and it looks like
 * a permission bug until you know it was chosen: membership is a fact about
 * the cookbook, not about the recipe, so a reader can collect a recipe they
 * could not edit. Requiring edit on both would leave someone browsing
 * hundreds of recipes on a default instance able to file almost none of them
 * (ADR-0027).
 *
 * The recipe row is never written: no version bump, no notification, no
 * realtime event on the recipe. Being collected is not an edit.
 */
const setMembership = authedProcedure
  .input(CookbookMembershipInputSchema)
  .mutation(async ({ ctx, input }) => {
    await assertRecipeAccess(ctx, input.recipeId, "view");
    await assertCookbookAccess(ctx, input.cookbookId, "edit");

    if (input.isMember) {
      // Idempotent by the unique pair, so a double tap changes nothing.
      await addRecipeToCookbook(input.cookbookId, input.recipeId);
    } else {
      await removeRecipeFromCookbook(input.cookbookId, input.recipeId);
    }

    log.info(
      {
        userId: ctx.user.id,
        cookbookId: input.cookbookId,
        recipeId: input.recipeId,
        isMember: input.isMember,
      },
      input.isMember ? "Recipe filed into cookbook" : "Recipe removed from cookbook"
    );

    await emitCookbookEvent(ctx, "membershipChanged", {
      cookbookId: input.cookbookId,
      recipeId: input.recipeId,
      isMember: input.isMember,
    });

    return { ...input };
  });

/** The cookbooks a recipe is in, as its own page lists them. */
const forRecipe = authedProcedure
  .input(CookbookForRecipeInputSchema)
  .output(z.array(CookbookSummarySchema))
  .query(async ({ ctx, input }) => {
    await assertRecipeAccess(ctx, input.recipeId, "view");

    return listCookbooksForRecipe(listContextFor(ctx), input.recipeId);
  });

/**
 * Every cookbook the reader may edit — the membership panel's list.
 *
 * Not scoped to a recipe: the answer is the same whatever is being filed, so
 * one read serves every recipe page and the Warm Set has one thing to
 * guarantee rather than one per recipe (ADR-0009). Which of them already hold
 * a given recipe comes from `forRecipe`.
 */
const editable = authedProcedure
  .output(z.array(CookbookSummarySchema))
  .query(async ({ ctx }) => listEditableCookbooks(listContextFor(ctx)));

/**
 * A cookbook's members, paged through the recipe list itself.
 *
 * Reusing `listRecipes` is the point: the members answer the same view policy
 * condition the Library applies, so the count on the card and the list on the
 * page agree by construction, and a large cookbook stays usable under the
 * reader's own search and filters (ADR-0027).
 */
const recipes = authedProcedure
  .input(CookbookRecipesInputSchema)
  .output(RecipeListResultSchema)
  .query(async ({ ctx, input }) => {
    // Seeing a cookbook is enough to browse it; the members filter themselves.
    await assertCookbookAccess(ctx, input.cookbookId, "view");

    const result = await listRecipes(
      listContextFor(ctx),
      input.limit,
      input.cursor,
      input.search,
      input.searchFields,
      input.tags,
      input.filterMode as FilterMode,
      input.sortMode as SortOrder,
      input.minRating,
      input.maxCookingTime,
      input.categories,
      { cookbookId: input.cookbookId, favoritesOnly: input.favoritesOnly }
    );

    return {
      recipes: result.recipes,
      total: result.total,
      nextCursor: input.cursor + input.limit < result.total ? input.cursor + input.limit : null,
    };
  });

export const cookbookMembershipProcedures = router({
  setMembership,
  forRecipe,
  editable,
  recipes,
});
