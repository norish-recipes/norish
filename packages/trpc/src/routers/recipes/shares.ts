import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type {
  RecipeShareDto,
  RecipeShareLifecycleEventDto,
} from "@norish/shared/contracts/dto/recipe-shares";
import {
  getRecipePermissionPolicy,
  getTimerKeywords,
  getUnits,
  isTimersEnabled,
} from "@norish/config/server-config-loader";
import { UnitsMapSchema } from "@norish/config/zod/server-config";
import {
  createRecipeShare,
  deleteRecipeShare,
  getPublicRecipeView,
  getRecipeShareById,
  getRecipeShareInventoryByUserId,
  getRecipeShareInventoryForAdmin,
  getRecipeSharesByUserId,
  getRecipeShareStatus,
  reactivateRecipeShare,
  revokeRecipeShare,
  updateRecipeShare,
} from "@norish/db/repositories/recipe-shares";
import { trpcLogger as log } from "@norish/shared-server/logger";
import { TimerKeywordsSchema } from "@norish/shared/contracts/zod";
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
  RevokeRecipeShareInputSchema,
  UpdateRecipeShareInputSchema,
} from "@norish/shared/contracts/zod/recipe-shares";

import { emitByPolicy } from "../../helpers";
import { adminProcedure, authedProcedure, sharedRecipeProcedure } from "../../middleware";
import { router } from "../../trpc";
import { recipeEmitter } from "./emitter";
import { assertRecipeAccess } from "./helpers";

type ShareMutationContext = {
  user: { id: string };
  householdKey: string;
};

const recipeShareEventsByType = {
  created: "shareCreated",
  updated: "shareUpdated",
  revoked: "shareRevoked",
  reactivated: "shareReactivated",
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

async function getManageableShareOrThrow(
  ctx: { user: { id: string }; isServerAdmin: boolean },
  shareId: string
) {
  const share = await getRecipeShareById(shareId);

  if (!share || (share.userId !== ctx.user.id && !ctx.isServerAdmin)) {
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

const listMine = authedProcedure
  .output(z.array(RecipeShareInventorySchema))
  .query(async ({ ctx }) => getRecipeShareInventoryByUserId(ctx.user.id));

const listAdmin = adminProcedure
  .output(z.array(AdminRecipeShareInventorySchema))
  .query(async () => getRecipeShareInventoryForAdmin());

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
    const share = await getManageableShareOrThrow(ctx, input.id);

    if (!ctx.isServerAdmin) {
      await assertRecipeAccess(ctx, share.recipeId, "edit");
    }

    const result = await revokeRecipeShare(input.id, input.version);

    if (result.stale || !result.value) {
      return { ...toSummary(share), stale: true };
    }

    await emitRecipeShareEvent(ctx, result.value, "revoked");

    return { ...result.value, stale: false };
  });

const reactivate = authedProcedure
  .input(ReactivateRecipeShareInputSchema)
  .output(RecipeShareMutationResultSchema)
  .mutation(async ({ ctx, input }) => {
    const share = await getManageableShareOrThrow(ctx, input.id);

    if (!ctx.isServerAdmin) {
      await assertRecipeAccess(ctx, share.recipeId, "edit");
    }

    const result = await reactivateRecipeShare(input.id, input.version);

    if (result.stale || !result.value) {
      return { ...toSummary(share), stale: true };
    }

    await emitRecipeShareEvent(ctx, result.value, "reactivated");

    return { ...result.value, stale: false };
  });

const remove = authedProcedure
  .input(DeleteRecipeShareInputSchema)
  .output(RecipeShareDeleteResultSchema)
  .mutation(async ({ ctx, input }) => {
    const share = await getManageableShareOrThrow(ctx, input.id);

    if (!ctx.isServerAdmin) {
      await assertRecipeAccess(ctx, share.recipeId, "edit");
    }

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
  const publicRecipe = await getPublicRecipeView(
    ctx.sharedRecipe.share.recipeId,
    ctx.sharedRecipe.token
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
  shareListAdmin: listAdmin,
  shareGet: get,
  shareUpdate: update,
  shareRevoke: revoke,
  shareReactivate: reactivate,
  shareDelete: remove,
  getShared,
  sharePublicConfig,
});
