import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type {
  RecipeShareDto,
  RecipeShareLifecycleEventDto,
} from "@norish/shared/contracts/dto/recipe-shares";
import { TimerKeywordsSchema, UnitsMapSchema } from "@norish/config/zod/server-config";
import {
  createRecipeShare,
  deleteRecipeShare,
  getPublicRecipeView,
  getRecipeShareById,
  getRecipeShareInventoryByUserId,
  getRecipeShareInventoryForAdmin,
  getRecipeSharesByUserId,
  getRecipeShareUrl,
  reactivateRecipeShare,
  revokeRecipeShare,
  toRecipeShareSummary,
  updateRecipeShare,
} from "@norish/db/repositories/recipe-shares";
import {
  getTimerKeywords,
  getUnits,
  isTimersEnabled,
} from "@norish/shared-server/config/server-config-loader";
import { ingredientIconAddresses } from "@norish/shared-server/ingredients/icons";
import { trpcLogger as log } from "@norish/shared-server/logger";
import { recipeAudience } from "@norish/shared-server/realtime/audience";
import { recipes } from "@norish/shared-server/realtime/recipes";
import {
  AdminRecipeShareInventorySchema,
  CreateRecipeShareInputSchema,
  DeleteRecipeShareInputSchema,
  GetRecipeShareInputSchema,
  ListRecipeSharesInputSchema,
  PublicRecipeViewSchema,
  ReactivateRecipeShareInputSchema,
  RecipeShareCreatedSchema,
  RecipeShareDeleteResultSchema,
  RecipeShareInventorySchema,
  RecipeShareLifecycleEventSchema,
  RecipeShareMutationResultSchema,
  RecipeShareSummarySchema,
  RecipeShareUrlSchema,
  RevokeRecipeShareInputSchema,
  UpdateRecipeShareInputSchema,
} from "@norish/shared/contracts/zod/recipe-shares";

import { adminProcedure, authedProcedure, sharedRecipeProcedure } from "../../middleware";
import { router } from "../../trpc";
import { assertRecipeAccess } from "./helpers";

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
  share: Pick<RecipeShareDto, "id" | "recipeId" | "version">,
  type: RecipeShareLifecycleEventDto["type"]
) {
  const audience = await recipeAudience(share.recipeId);

  if (audience) {
    await recipes.publish(
      "shareEvent",
      { kind: type, share: toRecipeShareLifecycleEvent(share, type) },
      audience
    );
  }
}

async function getOwnedShareOrThrow(ctx: { user: { id: string } }, shareId: string) {
  const share = await getRecipeShareById(shareId);

  if (!share || share.userId !== ctx.user.id) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Recipe share not found" });
  }

  return share;
}

async function getShareOrThrow(shareId: string) {
  const share = await getRecipeShareById(shareId);

  if (!share) throw new TRPCError({ code: "NOT_FOUND", message: "Recipe share not found" });

  return share;
}

const create = authedProcedure
  .input(CreateRecipeShareInputSchema)
  .output(RecipeShareCreatedSchema)
  .mutation(async ({ ctx, input }) => {
    await assertRecipeAccess(ctx, input.recipeId, "edit");

    log.info({ userId: ctx.user.id, recipeId: input.recipeId }, "Creating recipe share");

    const share = await createRecipeShare(ctx.user.id, input);

    await emitRecipeShareEvent(share, "created");

    return share;
  });

const list = authedProcedure
  .input(ListRecipeSharesInputSchema)
  .output(z.array(RecipeShareSummarySchema))
  .query(async ({ ctx, input }) => {
    await assertRecipeAccess(ctx, input.recipeId, "edit");

    return getRecipeSharesByUserId(ctx.user.id, input.recipeId);
  });

const listMine = authedProcedure
  .output(z.array(RecipeShareInventorySchema))
  .query(async ({ ctx }) => getRecipeShareInventoryByUserId(ctx.user.id));

const get = authedProcedure
  .input(GetRecipeShareInputSchema)
  .output(RecipeShareSummarySchema)
  .query(async ({ ctx, input }) => {
    const share = await getOwnedShareOrThrow(ctx, input.id);

    await assertRecipeAccess(ctx, share.recipeId, "edit");

    return toRecipeShareSummary(share);
  });

const update = authedProcedure
  .input(UpdateRecipeShareInputSchema)
  .output(RecipeShareMutationResultSchema)
  .mutation(async ({ ctx, input }) => {
    const share = await getOwnedShareOrThrow(ctx, input.id);

    await assertRecipeAccess(ctx, share.recipeId, "edit");

    const result = await updateRecipeShare(input);

    if (result.stale || !result.value) {
      return { ...toRecipeShareSummary(share), stale: true };
    }

    await emitRecipeShareEvent(result.value, "updated");

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
      return { ...toRecipeShareSummary(share), stale: true };
    }

    await emitRecipeShareEvent(result.value, "revoked");

    return { ...result.value, stale: false };
  });

const reactivate = authedProcedure
  .input(ReactivateRecipeShareInputSchema)
  .output(RecipeShareMutationResultSchema)
  .mutation(async ({ ctx, input }) => {
    const share = await getOwnedShareOrThrow(ctx, input.id);

    await assertRecipeAccess(ctx, share.recipeId, "edit");

    const result = await reactivateRecipeShare(input.id, input.version);

    if (result.stale || !result.value) {
      return { ...toRecipeShareSummary(share), stale: true };
    }

    await emitRecipeShareEvent(result.value, "reactivated");

    return { ...result.value, stale: false };
  });

// Who made a share and may still edit its recipe may read its link; anyone else gets NOT_FOUND.
const url = authedProcedure
  .input(GetRecipeShareInputSchema)
  .output(RecipeShareUrlSchema)
  .query(async ({ ctx, input }) => {
    const share = await getOwnedShareOrThrow(ctx, input.id);

    await assertRecipeAccess(ctx, share.recipeId, "edit");

    return { url: getRecipeShareUrl(share) };
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
        { id: share.id, recipeId: share.recipeId, version: share.version },
        "deleted"
      );
    }

    return { success: true, stale: result.stale };
  });

// Share-link moderation: an admin lists and acts on every account's links, across households.
const listAdmin = adminProcedure
  .output(z.array(AdminRecipeShareInventorySchema))
  .query(async () => getRecipeShareInventoryForAdmin());

const revokeAdmin = adminProcedure
  .input(RevokeRecipeShareInputSchema)
  .output(RecipeShareMutationResultSchema)
  .mutation(async ({ input }) => {
    const share = await getShareOrThrow(input.id);
    const result = await revokeRecipeShare(input.id, input.version);

    if (result.stale || !result.value) {
      return { ...toRecipeShareSummary(share), stale: true };
    }

    await emitRecipeShareEvent(result.value, "revoked");

    return { ...result.value, stale: false };
  });

const reactivateAdmin = adminProcedure
  .input(ReactivateRecipeShareInputSchema)
  .output(RecipeShareMutationResultSchema)
  .mutation(async ({ input }) => {
    const share = await getShareOrThrow(input.id);
    const result = await reactivateRecipeShare(input.id, input.version);

    if (result.stale || !result.value) {
      return { ...toRecipeShareSummary(share), stale: true };
    }

    await emitRecipeShareEvent(result.value, "reactivated");

    return { ...result.value, stale: false };
  });

const removeAdmin = adminProcedure
  .input(DeleteRecipeShareInputSchema)
  .output(RecipeShareDeleteResultSchema)
  .mutation(async ({ input }) => {
    const share = await getShareOrThrow(input.id);
    const result = await deleteRecipeShare(input.id, input.version);

    if (!result.stale) {
      await emitRecipeShareEvent(
        { id: share.id, recipeId: share.recipeId, version: share.version },
        "deleted"
      );
    }

    return { success: true, stale: result.stale };
  });

const getShared = sharedRecipeProcedure.output(PublicRecipeViewSchema).query(async ({ ctx }) => {
  const publicRecipe = await getPublicRecipeView(
    ctx.sharedRecipe.share.recipeId,
    ctx.sharedRecipe.token,
    // Each line's icon by address: the public view carries no ids to look one up by.
    ingredientIconAddresses
  );

  if (!publicRecipe) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Shared recipe not found" });
  }

  return publicRecipe;
});

const sharePublicConfig = sharedRecipeProcedure
  .output(
    z.object({
      units: UnitsMapSchema,
      timersEnabled: z.boolean(),
      timerKeywords: TimerKeywordsSchema,
    })
  )
  .query(async () => {
    const [units, timersEnabled, timerKeywords] = await Promise.all([
      getUnits(),
      isTimersEnabled(),
      getTimerKeywords(),
    ]);

    return {
      units,
      timersEnabled,
      timerKeywords,
    };
  });

export const recipeSharesProcedures = router({
  shareCreate: create,
  shareList: list,
  shareListMine: listMine,
  shareGet: get,
  shareUpdate: update,
  shareRevoke: revoke,
  shareReactivate: reactivate,
  shareUrl: url,
  shareDelete: remove,
  shareListAdmin: listAdmin,
  shareRevokeAdmin: revokeAdmin,
  shareReactivateAdmin: reactivateAdmin,
  shareDeleteAdmin: removeAdmin,
  getShared,
  sharePublicConfig,
});
