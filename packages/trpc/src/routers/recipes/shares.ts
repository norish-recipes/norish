import type { RecipeShareDto } from "@norish/shared/contracts/dto/recipe-shares";

import { TRPCError } from "@trpc/server";
import {
  createRecipeShare,
  deleteRecipeShare,
  getPublicRecipeView,
  getRecipeShareById,
  getRecipeShareStatus,
  getRecipeSharesByUserId,
  revokeRecipeShare,
  updateRecipeShare,
} from "@norish/db/repositories/recipe-shares";
import { trpcLogger as log } from "@norish/shared-server/logger";
import {
  CreateRecipeShareInputSchema,
  DeleteRecipeShareInputSchema,
  GetRecipeShareInputSchema,
  ListRecipeSharesInputSchema,
  PublicRecipeViewSchema,
  RecipeShareCreatedSchema,
  RecipeShareDeleteResultSchema,
  RecipeShareMutationResultSchema,
  RecipeShareSummarySchema,
  RevokeRecipeShareInputSchema,
  UpdateRecipeShareInputSchema,
} from "@norish/shared/contracts/zod/recipe-shares";
import { z } from "zod";

import { authedProcedure, sharedRecipeProcedure } from "../../middleware";
import { router } from "../../trpc";

import { assertRecipeAccess } from "./recipes";

function toSummary(share: RecipeShareDto) {
  return RecipeShareSummarySchema.parse({
    ...share,
    status: getRecipeShareStatus(share),
  });
}

async function getOwnedShareOrThrow(ctx: { user: { id: string } }, shareId: string) {
  const share = await getRecipeShareById(shareId);

  if (!share || share.userId !== ctx.user.id) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Recipe share not found" });
  }

  return share;
}

const create = authedProcedure
  .input(CreateRecipeShareInputSchema)
  .output(RecipeShareCreatedSchema)
  .mutation(async ({ ctx, input }) => {
    await assertRecipeAccess(ctx, input.recipeId, "edit");

    log.info({ userId: ctx.user.id, recipeId: input.recipeId }, "Creating recipe share");

    return createRecipeShare(ctx.user.id, input);
  });

const list = authedProcedure
  .input(ListRecipeSharesInputSchema)
  .output(z.array(RecipeShareSummarySchema))
  .query(async ({ ctx, input }) => {
    await assertRecipeAccess(ctx, input.recipeId, "edit");

    return getRecipeSharesByUserId(ctx.user.id, input.recipeId);
  });

const get = authedProcedure
  .input(GetRecipeShareInputSchema)
  .output(RecipeShareSummarySchema)
  .query(async ({ ctx, input }) => {
    const share = await getOwnedShareOrThrow(ctx, input.id);

    await assertRecipeAccess(ctx, share.recipeId, "edit");

    return toSummary(share);
  });

const update = authedProcedure
  .input(UpdateRecipeShareInputSchema)
  .output(RecipeShareMutationResultSchema)
  .mutation(async ({ ctx, input }) => {
    const share = await getOwnedShareOrThrow(ctx, input.id);

    await assertRecipeAccess(ctx, share.recipeId, "edit");

    const result = await updateRecipeShare(input);

    if (result.stale || !result.value) {
      return { ...toSummary(share), stale: true };
    }

    return { ...result.value, stale: false };
  });

const revoke = authedProcedure
  .input(RevokeRecipeShareInputSchema)
  .output(RecipeShareMutationResultSchema)
  .mutation(async ({ ctx, input }) => {
    const share = await getOwnedShareOrThrow(ctx, input.id);

    await assertRecipeAccess(ctx, share.recipeId, "edit");

    const result = await revokeRecipeShare(input.id, input.version);

    if (result.stale || !result.value) {
      return { ...toSummary(share), stale: true };
    }

    return { ...result.value, stale: false };
  });

const remove = authedProcedure
  .input(DeleteRecipeShareInputSchema)
  .output(RecipeShareDeleteResultSchema)
  .mutation(async ({ ctx, input }) => {
    const share = await getOwnedShareOrThrow(ctx, input.id);

    await assertRecipeAccess(ctx, share.recipeId, "edit");

    const result = await deleteRecipeShare(input.id, input.version);

    return { success: true, stale: result.stale };
  });

const getShared = sharedRecipeProcedure.output(PublicRecipeViewSchema).query(async ({ ctx }) => {
  const publicRecipe = await getPublicRecipeView(ctx.sharedRecipe.share.recipeId, ctx.sharedRecipe.token);

  if (!publicRecipe) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Shared recipe not found" });
  }

  return publicRecipe;
});

export const recipeSharesProcedures = router({
  shareCreate: create,
  shareList: list,
  shareGet: get,
  shareUpdate: update,
  shareRevoke: revoke,
  shareDelete: remove,
  getShared,
});
