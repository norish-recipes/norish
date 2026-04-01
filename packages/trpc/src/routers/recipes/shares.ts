import type { RecipeShareDto, RecipeShareLifecycleEventDto } from "@norish/shared/contracts/dto/recipe-shares";

import { getRecipePermissionPolicy } from "@norish/config/server-config-loader";
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
  RecipeShareLifecycleEventSchema,
  RecipeShareMutationResultSchema,
  RecipeShareSummarySchema,
  RevokeRecipeShareInputSchema,
  UpdateRecipeShareInputSchema,
} from "@norish/shared/contracts/zod/recipe-shares";
import { z } from "zod";

import { authedProcedure, sharedRecipeProcedure } from "../../middleware";
import { emitByPolicy } from "../../helpers";
import { router } from "../../trpc";

import { recipeEmitter } from "./emitter";
import { assertRecipeAccess } from "./recipes";

type ShareMutationContext = {
  user: { id: string };
  householdKey: string;
};

const recipeShareEventsByType = {
  created: "shareCreated",
  updated: "shareUpdated",
  revoked: "shareRevoked",
  deleted: "shareDeleted",
} as const;

function toSummary(share: RecipeShareDto) {
  return RecipeShareSummarySchema.parse({
    ...share,
    status: getRecipeShareStatus(share),
  });
}

function toRecipeShareLifecycleEvent(
  share: Pick<RecipeShareDto, "id" | "recipeId" | "version">,
  type: RecipeShareLifecycleEventDto["type"]
) {
  return RecipeShareLifecycleEventSchema.parse({
    type,
    recipeId: share.recipeId,
    shareId: share.id,
    version: share.version,
  });
}

async function emitRecipeShareEvent(
  ctx: ShareMutationContext,
  share: Pick<RecipeShareDto, "id" | "recipeId" | "version">,
  type: RecipeShareLifecycleEventDto["type"]
) {
  const policy = await getRecipePermissionPolicy();

  emitByPolicy(
    recipeEmitter,
    policy.view,
    { userId: ctx.user.id, householdKey: ctx.householdKey },
    recipeShareEventsByType[type],
    toRecipeShareLifecycleEvent(share, type)
  );
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

    const share = await createRecipeShare(ctx.user.id, input);

    await emitRecipeShareEvent(ctx, share, "created");

    return share;
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

    await emitRecipeShareEvent(ctx, result.value, "updated");

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

    await emitRecipeShareEvent(ctx, result.value, "revoked");

    return { ...result.value, stale: false };
  });

const remove = authedProcedure
  .input(DeleteRecipeShareInputSchema)
  .output(RecipeShareDeleteResultSchema)
  .mutation(async ({ ctx, input }) => {
    const share = await getOwnedShareOrThrow(ctx, input.id);

    await assertRecipeAccess(ctx, share.recipeId, "edit");

    const result = await deleteRecipeShare(input.id, input.version);

    if (!result.stale) {
      await emitRecipeShareEvent(
        ctx,
        { id: share.id, recipeId: share.recipeId, version: share.version },
        "deleted"
      );
    }

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
