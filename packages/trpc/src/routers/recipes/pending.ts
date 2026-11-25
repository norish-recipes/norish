import type { Job } from "bullmq";

import type { PendingRecipeDTO } from "@norish/shared/contracts";
import { getQueues } from "@norish/queue/registry";
import { trpcLogger as log } from "@norish/shared-server/logger";

import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";
import { canViewImportOf } from "./helpers";

const RUNNING_STATES = ["waiting", "active", "delayed"] as const;

type ImportJob = Job<{ userId: string }>;

const getPending = authedProcedure.query(async ({ ctx }) => {
  log.debug({ userId: ctx.user.id }, "Fetching pending recipe imports");

  const queues = getQueues();

  // Every import kind has a placeholder card, so a reread must list them all.
  const [urlJobs, imageJobs, pasteJobs] = await Promise.all([
    queues.recipeImport.getJobs([...RUNNING_STATES]),
    queues.imageImport.getJobs([...RUNNING_STATES]),
    queues.pasteImport.getJobs([...RUNNING_STATES]),
  ]);
  // Each import is its account's, in the household that account is in now.
  const viewable = new Set<string>();

  for (const userId of new Set(
    [...urlJobs, ...imageJobs, ...pasteJobs].map((j) => j.data.userId)
  )) {
    if (await canViewImportOf(ctx, userId)) viewable.add(userId);
  }
  const visible = (job: ImportJob): boolean => viewable.has(job.data.userId);

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
