import type { Queue } from "bullmq";

import type { IngredientIconsJobData } from "@norish/queue/contracts/job-types";

/** Start a Draw icons round over these foods. Answers the job's id, which the page watches the round by. */
export async function addIngredientIconsJob(
  queue: Queue<IngredientIconsJobData>,
  data: IngredientIconsJobData
): Promise<string> {
  const job = await queue.add("draw", data);

  return job.id ?? "";
}
