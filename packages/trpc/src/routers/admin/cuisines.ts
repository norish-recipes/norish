/**
 * Cuisine vocabulary administration.
 *
 * The vocabulary is owned by an administrator, so these are the only write
 * paths that exist besides the `extend` cuisine strategy. Every one of them
 * delegates to the cuisines repository rather than composing queries here.
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createCuisine, deleteCuisine, renameCuisine } from "@norish/db/repositories/cuisines";
import { trpcLogger as log } from "@norish/shared-server/logger";
import { CuisineNameSchema } from "@norish/shared/contracts/zod";

import { adminProcedure } from "../../middleware";
import { router } from "../../trpc";

const create = adminProcedure
  .input(z.object({ name: CuisineNameSchema }))
  .mutation(async ({ ctx, input }) => {
    log.info({ userId: ctx.user.id, name: input.name }, "Adding a Cuisine");

    try {
      return await createCuisine(input.name);
    } catch (err) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "A Cuisine with that name already exists",
        cause: err,
      });
    }
  });

const rename = adminProcedure
  .input(z.object({ id: z.uuid(), name: CuisineNameSchema }))
  .mutation(async ({ ctx, input }) => {
    log.info({ userId: ctx.user.id, cuisineId: input.id }, "Renaming a Cuisine");

    let renamed;

    try {
      renamed = await renameCuisine(input.id, input.name);
    } catch (err) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "A Cuisine with that name already exists",
        cause: err,
      });
    }

    if (!renamed) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Cuisine not found" });
    }

    return renamed;
  });

/**
 * Remove a Cuisine.
 *
 * A silent cascade with no usage count: recipes referencing it simply lose it,
 * and any provenance note that argued for it is deliberately left alone.
 */
const remove = adminProcedure.input(z.object({ id: z.uuid() })).mutation(async ({ ctx, input }) => {
  log.info({ userId: ctx.user.id, cuisineId: input.id }, "Deleting a Cuisine");

  if (!(await deleteCuisine(input.id))) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Cuisine not found" });
  }

  return { success: true };
});

export const cuisinesProcedures = router({
  create,
  rename,
  delete: remove,
});
