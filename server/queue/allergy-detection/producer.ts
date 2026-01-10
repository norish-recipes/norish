/**
 * Allergy Detection Producer - Application Logic
 *
 * Enqueue logic for allergy detection jobs.
 * Accepts a queue instance - does not manage lifecycle.
 */

import type { Queue } from "bullmq";
import type { AllergyDetectionJobData, AddAllergyDetectionJobResult } from "@/types";

import { isJobInQueue } from "../helpers";

import { createLogger } from "@/server/logger";
import { isAIEnabled, getAIConfig } from "@/config/server-config-loader";
import { getAllergiesForUsers, getHouseholdMemberIds } from "@/server/db";

const log = createLogger("queue:allergy-detection");

/**
 * Add an allergy detection job to the queue.
 * Returns "skipped" if AI is disabled, autoTagAllergies is disabled, or no allergies configured.
 * Returns "duplicate" if a job already exists in queue.
 */
export async function addAllergyDetectionJob(
  queue: Queue<AllergyDetectionJobData>,
  data: AllergyDetectionJobData
): Promise<AddAllergyDetectionJobResult> {
  // Check if AI is enabled
  const aiEnabled = await isAIEnabled();

  if (!aiEnabled) {
    return { status: "skipped", reason: "disabled" };
  }

  // Check if autoTagAllergies is enabled
  const aiConfig = await getAIConfig();

  if (!aiConfig?.autoTagAllergies) {
    return { status: "skipped", reason: "disabled" };
  }

  // Check if household has any allergies configured
  const householdUserIds = await getHouseholdMemberIds(data.userId);
  const householdAllergies = await getAllergiesForUsers(householdUserIds);

  if (householdAllergies.length === 0) {
    log.debug({ recipeId: data.recipeId }, "No allergies configured for household, skipping");

    return { status: "skipped", reason: "no_allergies" };
  }

  const jobId = `allergy-detect-${data.recipeId}`;

  log.debug({ recipeId: data.recipeId, jobId }, "Attempting to add allergy detection job");

  if (await isJobInQueue(queue, jobId)) {
    log.warn({ recipeId: data.recipeId, jobId }, "Duplicate allergy detection job rejected");

    return { status: "duplicate", existingJobId: jobId };
  }

  const job = await queue.add("allergy-detect", data, { jobId });

  log.info({ recipeId: data.recipeId, jobId: job.id }, "Allergy detection job added to queue");

  return { status: "queued", job };
}

/**
 * Check if an allergy detection job is currently active for the given recipe.
 */
export async function isAllergyDetectionJobActive(
  queue: Queue<AllergyDetectionJobData>,
  recipeId: string
): Promise<boolean> {
  const jobId = `allergy-detect-${recipeId}`;

  return isJobInQueue(queue, jobId);
}
