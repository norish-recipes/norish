import type { Job } from "bullmq";

import type { EnrichAllJobData } from "@norish/queue/contracts/job-types";
import { getHouseholdIdForUser } from "@norish/db/repositories/households";

import { createWorker } from "../create-worker";
import { enrollEnrichmentForAllRecipes } from "../enrichment/bulk";
import { completeStep, reportStep } from "../job-steps";
import { QUEUE_NAMES } from "../queue-names";

/** Exported so the job body can be exercised without a Valkey-backed worker. */
export async function processEnrichAllJob(job: Job<EnrichAllJobData>): Promise<void> {
  const { userId, householdId, replaceExisting } = job.data;

  // An administrator whose account went asks for nothing any more.
  if (!(await getHouseholdIdForUser(userId))) return;
  await reportStep(job, "running");
  const result = await enrollEnrichmentForAllRecipes({ userId, householdId }, { replaceExisting });

  await completeStep(job, result);
}

export function startEnrichAllWorker(): void {
  createWorker<EnrichAllJobData>(QUEUE_NAMES.ENRICH_ALL, processEnrichAllJob);
}
