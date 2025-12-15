import { router } from "../../trpc";
import { authedProcedure } from "../../middleware";

import { trpcLogger as log } from "@/server/logger";
import { recipeImportQueue } from "@/server/queue";
import { getRecipePermissionPolicy } from "@/config/server-config-loader";

import type { RecipeImportJobData, PendingRecipeDTO } from "@/types";

const getPending = authedProcedure.query(async ({ ctx }) => {
  log.debug({ userId: ctx.user.id }, "Fetching pending recipe imports");

  const policy = await getRecipePermissionPolicy();

  const jobs = await recipeImportQueue.getJobs(["waiting", "active", "delayed"]);

  const filteredJobs = jobs.filter((job) => {
    const data = job.data as RecipeImportJobData;

    switch (policy.view) {
      case "everyone":
        // Everyone can see all pending imports
        return true;
      case "household":
        // User can only see jobs from their household
        return data.householdKey === ctx.householdKey;
      case "owner":
        // User can only see their own jobs
        return data.userId === ctx.user.id;
    }
  });

  const pendingRecipes: PendingRecipeDTO[] = filteredJobs.map((job) => ({
    recipeId: job.data.recipeId,
    url: job.data.url,
    addedAt: job.timestamp,
  }));

  log.debug({ userId: ctx.user.id, count: pendingRecipes.length }, "Found pending recipe imports");

  return pendingRecipes;
});

export const pendingProcedures = router({
  getPending,
});
