import type { Queue } from "bullmq";

import type { IngredientReviewJobData } from "@norish/queue/contracts/job-types";

/**
 * Start a round of Ask AI over these Flagged Ingredients. Every round is its
 * own job: a person asked about the foods on their screen, and asking again
 * about a food a round already settled costs nothing but a skipped step, so
 * no two rounds need to be told apart by id. Answers the job's id, which the
 * page watches the round by.
 */
export async function addIngredientReviewJob(
  queue: Queue<IngredientReviewJobData>,
  data: IngredientReviewJobData
): Promise<string> {
  const job = await queue.add("review", data);

  return job.id ?? "";
}
