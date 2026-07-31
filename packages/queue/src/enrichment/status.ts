/**
 * Combined Recipe Enrichment status.
 *
 * The authoritative initial and recovery read. It maps retained BullMQ state
 * onto the shared lifecycle vocabulary rather than persisting a second status
 * table, which is why configured retention removing a terminal job naturally
 * returns that kind to `idle`.
 *
 * Job identity is deterministic per recipe and kind, so at most one retained run
 * exists per kind and "the current or latest run" needs no extra selection.
 */

import type {
  RecipeEnrichmentKindStatus,
  RecipeEnrichmentStatusDto,
} from "@norish/shared/lib/recipe-enrichment";
import { ENRICHMENT_KINDS, toEnrichmentLifecycleState } from "@norish/shared/lib/recipe-enrichment";

import type { RecipeEnrichmentJobData } from "../contracts/job-types";
import { getQueueByName } from "../registry";
import { ENRICHMENT_QUEUE_NAMES, enrichmentJobId } from "./identity";

/**
 * Read the lifecycle state of every enrichment kind for one recipe.
 *
 * Always returns an entry per kind so a client never has to distinguish
 * "no data yet" from `idle`.
 */
export async function getRecipeEnrichmentStatus(
  recipeId: string
): Promise<RecipeEnrichmentStatusDto> {
  const kinds = await Promise.all(
    ENRICHMENT_KINDS.map(async (kind): Promise<RecipeEnrichmentKindStatus> => {
      const queue = getQueueByName(ENRICHMENT_QUEUE_NAMES[kind]);
      const job = await queue.getJob(enrichmentJobId(kind, recipeId));

      if (!job) {
        return { kind, state: "idle", origin: null, runId: null, runSequence: null };
      }

      const data = job.data as RecipeEnrichmentJobData | undefined;

      return {
        kind,
        state: toEnrichmentLifecycleState(await job.getState()),
        origin: data?.origin ?? null,
        runId: data?.runId ?? enrichmentJobId(kind, recipeId),
        runSequence: data?.runSequence ?? 0,
      };
    })
  );

  return { recipeId, kinds };
}
