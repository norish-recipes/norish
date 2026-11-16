import type { Job } from "bullmq";

import type { PendingRecipeDTO } from "@norish/shared/contracts";
import { getQueues } from "@norish/queue/registry";
import { getRecipePermissionPolicy } from "@norish/shared-server/config/server-config-loader";
import { trpcLogger as log } from "@norish/shared-server/logger";

import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";

const RUNNING_STATES = ["waiting", "active", "delayed"] as const;

type ImportJob = Job<{ userId: string; householdKey: string }>;

const getPending = authedProcedure.query(async ({ ctx }) => {
  log.debug({ userId: ctx.user.id }, "Fetching pending recipe imports");

  const policy = await getRecipePermissionPolicy();
  const queues = getQueues();

  const visible = (job: ImportJob): boolean => {
    switch (policy.view) {
      case "everyone":
        return true;
      case "household":
        return job.data.householdKey === ctx.householdKey;
      case "owner":
        return job.data.userId === ctx.user.id;
    }

    return false;
  };

  // Every import kind has a placeholder card, so a reread must list them all.
  const [urlJobs, imageJobs, pasteJobs] = await Promise.all([
    queues.recipeImport.getJobs([...RUNNING_STATES]),
    queues.imageImport.getJobs([...RUNNING_STATES]),
    queues.pasteImport.getJobs([...RUNNING_STATES]),
  ]);

  const pendingRecipes: PendingRecipeDTO[] = [
    ...urlJobs.filter(visible).map((job) => ({
      recipeId: job.data.recipeId,
      url: job.data.url,
      addedAt: job.timestamp,
    })),
    ...imageJobs.filter(visible).map((job) => ({
      recipeId: job.data.recipeId,
      url: "",
      addedAt: job.timestamp,
    })),
    ...pasteJobs
      .filter(visible)
      .flatMap((job) =>
        job.data.recipeIds.map((recipeId) => ({ recipeId, url: "", addedAt: job.timestamp }))
      ),
  ];

  log.debug({ userId: ctx.user.id, count: pendingRecipes.length }, "Found pending recipe imports");

  return pendingRecipes;
});

export const pendingProcedures = router({
  getPending,
});
