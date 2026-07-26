import type { Job } from "bullmq";

import type { RecipeImportJobData } from "@norish/queue/contracts/job-types";
import type { PendingRecipeDTO } from "@norish/shared/contracts";
import { getQueues } from "@norish/queue/registry";
import { getRecipePermissionPolicy } from "@norish/shared-server/config/server-config-loader";
import { trpcLogger as log } from "@norish/shared-server/logger";

import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";

const getPending = authedProcedure.query(async ({ ctx }) => {
  log.debug({ userId: ctx.user.id }, "Fetching pending recipe imports");

  const policy = await getRecipePermissionPolicy();
  const queues = getQueues();

  const jobs = await queues.recipeImport.getJobs(["waiting", "active", "delayed"]);

  const filteredJobs = jobs.filter((job: Job<RecipeImportJobData>) => {
    const data = job.data;

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

    return false;
  });

  const pendingRecipes: PendingRecipeDTO[] = filteredJobs.map((job: Job<RecipeImportJobData>) => ({
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
