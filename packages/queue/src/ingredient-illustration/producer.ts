import type { Queue } from "bullmq";

import type { IngredientIllustrationJobData } from "@norish/queue/contracts/job-types";

export type AddIngredientIllustrationResult = "queued" | "duplicate";

/**
 * One job per Ingredient Name while one is waiting or running, so a double
 * click or a "generate missing" run over a name already queued never pays
 * for the same picture twice. Never `|`-free ids with `:` — BullMQ reserves it.
 */
export function ingredientIllustrationJobId(ingredientId: string): string {
  return `illustration|${ingredientId}`;
}

/**
 * **Never enqueue on this queue with `delay`.** It is a lazy queue, and a
 * delayed job on a sleeping lazy queue is never promoted
 * (`packages/queue/src/lazy-worker-manager.ts`).
 */
export async function addIngredientIllustrationJob(
  queue: Queue<IngredientIllustrationJobData>,
  data: IngredientIllustrationJobData
): Promise<AddIngredientIllustrationResult> {
  const jobId = ingredientIllustrationJobId(data.ingredientId);
  const existing = await queue.getJob(jobId);

  if (existing) {
    const state = await existing.getState();

    if (
      state === "waiting" ||
      state === "active" ||
      state === "delayed" ||
      state === "prioritized"
    ) {
      return "duplicate";
    }

    // A finished job keeps its id for as long as retention says; clear it so
    // the administrator can ask for a new picture straight away.
    await existing.remove();
  }

  await queue.add("draw-illustration", data, { jobId });

  return "queued";
}
