import { z } from "zod";

import {
  addRecipeToCookbook,
  listCookbooksForRecipe,
  listEditableCookbooksForRecipe,
  removeRecipeFromCookbook,
} from "@norish/db/repositories/cookbooks";
import { trpcLogger as log } from "@norish/shared-server/logger";
import {
  CookbookForRecipeInputSchema,
  CookbookMembershipInputSchema,
  CookbookSummarySchema,
  EditableCookbookSchema,
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
  .meta({
    openapi: {
      method: "GET",
      path: "/recipes/{recipeId}/cookbooks",
      protect: true,
      tags: ["Cookbooks"],
      summary: "List the cookbooks a recipe is in",
      errorResponses: {
        401: "Missing or invalid API credentials",
        404: "Recipe not found",
      },
    },
  })
  .input(CookbookForRecipeInputSchema)
  .output(z.array(CookbookSummarySchema))
  .query(async ({ ctx, input }) => {
    await assertRecipeAccess(ctx, input.recipeId, "view");

    return listCookbooksForRecipe(listContextFor(ctx), input.recipeId);
  });

/**
 * Every cookbook the reader may edit, each saying whether it already holds
 * this recipe — the membership panel's whole list, so one place both files
 * and unfiles.
 */
const editableForRecipe = authedProcedure
  .input(CookbookForRecipeInputSchema)
  .output(z.array(EditableCookbookSchema))
  .query(async ({ ctx, input }) => {
    await assertRecipeAccess(ctx, input.recipeId, "view");

    return listEditableCookbooksForRecipe(listContextFor(ctx), input.recipeId);
  });

export const cookbookMembershipProcedures = router({
  setMembership,
  forRecipe,
  editableForRecipe,
});
