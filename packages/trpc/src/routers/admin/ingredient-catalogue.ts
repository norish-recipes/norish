import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type { CleanUpScope } from "@norish/queue/ingredient-review/producer";
import { addFillGapsJobs, isFillGapsRunning } from "@norish/queue/ingredient-fill/producer";
import {
  addCatalogueCleanUpJob,
  isCatalogueCleanUpRunning,
  listCleanUpFoods,
} from "@norish/queue/ingredient-review/producer";
import { canDrawImages, isAIEnabled } from "@norish/shared-server/config/server-config-loader";
import { listFillGapsFoods } from "@norish/shared-server/ingredients/nutrition/fill-gaps";
import { trpcLogger as log } from "@norish/shared-server/logger";

import { adminProcedure } from "../../middleware";
import { router } from "../../trpc";

const CleanUpScopeSchema = z.enum(["recipe-foods", "whole-catalogue"] satisfies CleanUpScope[]);

/** How many foods each scope's Clean up catalogue asks about, and whether a run is on. */
const cleanUpCounts = adminProcedure.query(async () => {
  const [recipeFoods, wholeCatalogue, running] = await Promise.all([
    listCleanUpFoods("recipe-foods"),
    listCleanUpFoods("whole-catalogue"),
    isCatalogueCleanUpRunning(),
  ]);

  return { recipeFoods: recipeFoods.length, wholeCatalogue: wholeCatalogue.length, running };
});

/** Start a Clean up catalogue run, one job on the review queue; answers how many foods it asks about. */
const cleanUp = adminProcedure
  .input(z.object({ scope: CleanUpScopeSchema }))
  .mutation(async ({ input, ctx }) => {
    if (!(await isAIEnabled())) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "AI is disabled" });
    }
    if (await isCatalogueCleanUpRunning()) {
      throw new TRPCError({ code: "CONFLICT", message: "A clean-up is already running" });
    }
    const queued = await addCatalogueCleanUpJob(input.scope);

    log.info({ userId: ctx.user.id, scope: input.scope, queued }, "Catalogue clean-up queued");

    return { queued };
  });

/** How many listed foods each Fill gaps box fills (icons null where nothing draws); whether one runs. */
const fillGapsCounts = adminProcedure.query(async () => {
  const [foods, canDraw, running] = await Promise.all([
    listFillGapsFoods(),
    canDrawImages(),
    isFillGapsRunning(),
  ]);

  return {
    nutrition: foods.nutrition.length,
    conversions: foods.conversions.length,
    icons: canDraw ? foods.icons.length : null,
    running,
  };
});

/** Start a Fill gaps run over every listed food: a fill job, an icon job, or both. */
const fillGaps = adminProcedure
  .input(z.object({ nutrition: z.boolean(), conversions: z.boolean(), icons: z.boolean() }))
  .mutation(async ({ input, ctx }) => {
    if (!(await isAIEnabled())) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "AI is disabled" });
    }
    if (input.icons && !(await canDrawImages())) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No image provider can draw" });
    }
    if (await isFillGapsRunning()) {
      throw new TRPCError({ code: "CONFLICT", message: "Fill gaps is already running" });
    }
    await addFillGapsJobs(input);

    log.info({ userId: ctx.user.id, ...input }, "Fill gaps queued");
  });

export const ingredientCatalogueProcedures = router({
  cleanUpCounts,
  cleanUp,
  fillGapsCounts,
  fillGaps,
});
