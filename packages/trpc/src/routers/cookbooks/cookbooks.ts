import { TRPCError } from "@trpc/server";

import {
  createCookbook,
  deleteCookbookById,
  getCookbookForViewer,
  listCookbooks,
  renameCookbook,
  withMemberSummaries,
} from "@norish/db/repositories/cookbooks";
import { trpcLogger as log } from "@norish/shared-server/logger";
import {
  CookbookCreateInputSchema,
  CookbookDeleteInputSchema,
  CookbookGetInputSchema,
  CookbookListInputSchema,
  CookbookListResultSchema,
  CookbookRenameInputSchema,
  CookbookSummarySchema,
} from "@norish/shared/contracts/zod";

import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";
import { assertCookbookAccess, emitCookbookEvent, listContextFor } from "./helpers";

const list = authedProcedure
  .meta({
    openapi: {
      method: "POST",
      path: "/cookbooks/search",
      protect: true,
      tags: ["Cookbooks"],
      summary: "List cookbooks",
      description:
        "Returns a paginated list of the cookbooks the caller may see. All filter fields are optional.",
      errorResponses: {
        401: "Missing or invalid API credentials",
      },
    },
  })
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
  .meta({
    openapi: {
      method: "GET",
      path: "/cookbooks/{id}",
      protect: true,
      tags: ["Cookbooks"],
      summary: "Get a cookbook by ID",
      errorResponses: {
        401: "Missing or invalid API credentials",
        404: "Cookbook not found",
      },
    },
  })
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
  .meta({
    openapi: {
      method: "POST",
      path: "/cookbooks",
      protect: true,
      tags: ["Cookbooks"],
      summary: "Create a cookbook",
      errorResponses: {
        401: "Missing or invalid API credentials",
      },
    },
  })
  .input(CookbookCreateInputSchema)
  .output(CookbookSummarySchema)
  .mutation(async ({ ctx, input }) => {
    const cookbook = await createCookbook({
      id: input.id,
      userId: ctx.user.id,
      title: input.title,
    });

    log.info({ userId: ctx.user.id, cookbookId: cookbook.id }, "Cookbook created");
    await emitCookbookEvent(ctx, "created", { cookbook });

    return cookbook;
  });

const rename = authedProcedure
  .input(CookbookRenameInputSchema)
  .output(CookbookSummarySchema.nullable())
  .mutation(async ({ ctx, input }) => {
    await assertCookbookAccess(ctx, input.id, "edit");

    const outcome = await renameCookbook(input.id, input.title, input.version);

    if (outcome.stale || !outcome.value) {
      log.info(
        { userId: ctx.user.id, cookbookId: input.id, version: input.version },
        "Ignoring stale cookbook rename"
      );

      return null;
    }

    // The member summaries are viewer-scoped, so the echo carries the actor's
    // own view of the renamed cookbook rather than a bare row.
    const [cookbook] = await withMemberSummaries(listContextFor(ctx), [outcome.value]);

    if (!cookbook) return null;

    log.info({ userId: ctx.user.id, cookbookId: cookbook.id }, "Cookbook renamed");
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
  log.info({ userId: ctx.user.id, cookbookId: input.id }, "Cookbook deleted");
  await emitCookbookEvent(ctx, "deleted", { id: input.id });

  return { id: input.id, deleted: true };
});

export const cookbooksProcedures = router({
  list,
  get,
  create,
  rename,
  remove,
});
