import { TRPCError } from "@trpc/server";

import {
  addRecipeToCookbook,
  createCookbook,
  deleteCookbookById,
  getCookbookForViewer,
  listCookbooks,
  updateCookbook,
  withMemberSummaries,
} from "@norish/db/repositories/cookbooks";
import { trpcLogger as log } from "@norish/shared-server/logger";
import { saveCookbookImageBytes, sweepCookbookImages } from "@norish/shared-server/media/storage";
import {
  CookbookCreateInputSchema,
  CookbookDeleteInputSchema,
  CookbookGetInputSchema,
  CookbookListInputSchema,
  CookbookListResultSchema,
  CookbookSummarySchema,
  CookbookUpdateInputSchema,
} from "@norish/shared/contracts/zod";

import { formDataInputSchema, getFormDataString } from "../../form-data";
import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";
import { assertRecipeAccess } from "../recipes/helpers";
import { extractAndValidateImage } from "../recipes/images";
import { assertCookbookAccess, emitCookbookEvent, listContextFor } from "./helpers";

const list = authedProcedure
  .input(CookbookListInputSchema)
  .output(CookbookListResultSchema)
  .query(async ({ ctx, input }) => {
    const result = await listCookbooks(listContextFor(ctx), {
      limit: input.limit,
      offset: input.cursor,
      search: input.search,
      sortMode: input.sortMode,
    });

    return {
      cookbooks: result.cookbooks,
      total: result.total,
      nextCursor: input.cursor + input.limit < result.total ? input.cursor + input.limit : null,
    };
  });

const get = authedProcedure
  .input(CookbookGetInputSchema)
  .output(CookbookSummarySchema)
  .query(async ({ ctx, input }) => {
    const cookbook = await getCookbookForViewer(listContextFor(ctx), input.id);

    if (!cookbook) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Cookbook not found" });
    }

    return cookbook;
  });

const create = authedProcedure
  .input(CookbookCreateInputSchema)
  .output(CookbookSummarySchema)
  .mutation(async ({ ctx, input }) => {
    // A cookbook made from a recipe holds it from the first moment, so
    // "these two belong together" is one step. Only view rights on the
    // recipe are needed, and the recipe itself is not written (ADR-0027).
    if (input.recipeId) {
      await assertRecipeAccess(ctx, input.recipeId, "view");
    }

    const cookbook = await createCookbook({
      id: input.id,
      userId: ctx.user.id,
      title: input.title,
    });

    if (input.recipeId) {
      await addRecipeToCookbook(cookbook.id, input.recipeId);
    }

    log.info({ userId: ctx.user.id, cookbookId: cookbook.id }, "Cookbook created");
    await emitCookbookEvent(ctx, "created", {
      cookbook: input.recipeId ? { ...cookbook, memberCount: 1 } : cookbook,
    });

    if (input.recipeId) {
      await emitCookbookEvent(ctx, "membershipChanged", {
        cookbookId: cookbook.id,
        recipeId: input.recipeId,
        isMember: true,
      });
    }

    return input.recipeId ? { ...cookbook, memberCount: 1 } : cookbook;
  });

const update = authedProcedure
  .input(CookbookUpdateInputSchema)
  .output(CookbookSummarySchema.nullable())
  .mutation(async ({ ctx, input }) => {
    await assertCookbookAccess(ctx, input.id, "edit");

    const outcome = await updateCookbook(
      input.id,
      { title: input.title, image: input.image },
      input.version
    );

    if (outcome.stale || !outcome.value) {
      log.info(
        { userId: ctx.user.id, cookbookId: input.id, version: input.version },
        "Ignoring stale cookbook update"
      );

      return null;
    }

    // The member summaries are viewer-scoped, so the echo carries the actor's
    // own view of the updated cookbook rather than a bare row.
    const [cookbook] = await withMemberSummaries(listContextFor(ctx), [outcome.value]);

    if (!cookbook) return null;

    if (input.image !== undefined) await sweepCookbookImages(cookbook.id, input.image);

    log.info({ userId: ctx.user.id, cookbookId: cookbook.id }, "Cookbook updated");
    await emitCookbookEvent(ctx, "updated", { cookbook });

    return cookbook;
  });

const remove = authedProcedure.input(CookbookDeleteInputSchema).mutation(async ({ ctx, input }) => {
  await assertCookbookAccess(ctx, input.id, "delete");

  const outcome = await deleteCookbookById(input.id, input.version);

  if (outcome.stale) {
    log.info(
      { userId: ctx.user.id, cookbookId: input.id, version: input.version },
      "Ignoring stale cookbook delete"
    );

    return { id: input.id, deleted: false };
  }

  // Deleting a cookbook never touches its recipes; only the membership rows
  // go with it, through the join table's cascade.
  await sweepCookbookImages(input.id);
  log.info({ userId: ctx.user.id, cookbookId: input.id }, "Cookbook deleted");
  await emitCookbookEvent(ctx, "deleted", { id: input.id });

  return { id: input.id, deleted: true };
});

/**
 * Store a cover for a cookbook and hand back its URL. Nothing points at it
 * until an `update` saves it, which also sweeps away uploads never saved.
 */
const uploadImage = authedProcedure.input(formDataInputSchema).mutation(async ({ ctx, input }) => {
  const cookbookId = getFormDataString(input, "cookbookId");

  if (!cookbookId) return { success: false as const, error: "Cookbook ID is required" };

  await assertCookbookAccess(ctx, cookbookId, "edit");

  const validation = await extractAndValidateImage(input);

  if (!validation.success) return validation;

  const url = await saveCookbookImageBytes(validation.bytes, cookbookId);

  log.info({ userId: ctx.user.id, cookbookId, url }, "Cookbook image uploaded");

  return { success: true as const, url };
});

export const cookbooksProcedures = router({
  list,
  get,
  create,
  update,
  remove,
  uploadImage,
});
