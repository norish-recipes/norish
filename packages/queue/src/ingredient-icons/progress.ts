/**
 * What a Draw icons round has come to, read off the job's own step progress:
 * one step per food, "drawing-icon:3/12", completed with what came of it.
 * The worker publishes this as it goes, and the Ingredients page asks for it
 * when it opens, so a tab opened mid-round shows the same count.
 */

import type { Job, Queue } from "bullmq";

import type { IngredientIconsJobData } from "@norish/queue/contracts/job-types";
import type { IconRoundOutcome } from "@norish/shared-server/ingredients/icon-rounds";
import type { IconRound } from "@norish/shared/contracts/realtime/ingredients";

import { readStepProgress } from "../job-steps";

/** The base id of every food's step; the food's place in the round follows a colon. */
export const ICON_STEP = "drawing-icon";

/** What a food's completed step records: what came of it, or what broke. */
export type IconStepDetail = { ingredientId: string; name?: string } & (
  IconRoundOutcome | { outcome: "failed"; error: string }
);

/** What a settled food's step can come to, each counted under its own name. */
const OUTCOMES: ReadonlySet<string> = new Set(["drawn", "skipped", "failed"]);

/** The foods the latest attempt has settled, with what came of each. */
function settledSteps(progress: unknown): IconStepDetail[] {
  const attempts = readStepProgress(progress)?.attempts ?? [];
  const latest = attempts[attempts.length - 1];

  return (latest?.timeline ?? []).flatMap((step) => {
    const detail = step.detail as Partial<IconStepDetail> | undefined;

    return step.id.startsWith(ICON_STEP) &&
      step.endedAt !== undefined &&
      typeof detail?.ingredientId === "string" &&
      typeof detail.outcome === "string" &&
      OUTCOMES.has(detail.outcome)
      ? [detail as IconStepDetail]
      : [];
  });
}

/**
 * The round as the job's progress tells it, with the foods the worker has
 * settled but not yet written down (`unwritten`); only the latest attempt
 * counts.
 */
export function summarizeIconRound(
  job: Pick<Job<IngredientIconsJobData>, "id" | "data" | "progress">,
  finished: boolean,
  unwritten: readonly IconStepDetail[] = []
): IconRound {
  const counts = { drawn: 0, skipped: 0, failed: 0 };
  const settled = [...settledSteps(job.progress), ...unwritten];
  const over = finished || settled.length >= job.data.ingredients.length;
  const drawn = new Set(settled.map((step) => step.ingredientId));

  for (const step of settled) counts[step.outcome] += 1;

  return {
    jobId: job.id ?? "",
    done: settled.length,
    total: job.data.ingredients.length,
    counts,
    pending: over
      ? []
      : job.data.ingredients.flatMap((food) => (drawn.has(food.id) ? [] : [food.id])),
    finished: over,
  };
}

/** The round running or waiting on this instance, if any: one runs at a time. */
export async function findRunningIconRound(
  queue: Queue<IngredientIconsJobData>
): Promise<IconRound | null> {
  const [job] = await queue.getJobs(["active", "waiting", "prioritized", "delayed"], 0, 0, true);
  const round = job ? summarizeIconRound(job, false) : null;

  return round && !round.finished ? round : null;
}
