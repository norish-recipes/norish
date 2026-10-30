/**
 * Recipe Enrichment queue identity.
 *
 * One deterministic job id per recipe and kind. Duplicate delivery of the
 * creation event therefore coalesces into at most one effective enrollment,
 * which is what makes the non-durable event safe to observe from several
 * server instances.
 */

import type { Queue } from "bullmq";

import type { RecipeEnrichmentKind } from "@norish/shared/lib/recipe-enrichment";
import { toEnrichmentLifecycleState } from "@norish/shared/lib/recipe-enrichment";

import type { QueueName } from "../queue-names";
import { QUEUE_NAMES } from "../queue-names";

/** BullMQ job ids cannot contain colons, so kinds are joined with underscores. */
export function enrichmentJobId(kind: RecipeEnrichmentKind, recipeId: string): string {
  return `enrich_${kind}_${recipeId}`;
}

export const ENRICHMENT_QUEUE_NAMES: Record<RecipeEnrichmentKind, QueueName> = {
  "auto-tagging": QUEUE_NAMES.AUTO_TAGGING,
  "allergy-detection": QUEUE_NAMES.ALLERGY_DETECTION,
  "auto-categorization": QUEUE_NAMES.AUTO_CATEGORIZATION,
  "nutrition-estimation": QUEUE_NAMES.NUTRITION_ESTIMATION,
  "recipe-provenance": QUEUE_NAMES.RECIPE_PROVENANCE,
  "ingredient-linking": QUEUE_NAMES.INGREDIENT_LINKING,
  "image-generation": QUEUE_NAMES.IMAGE_GENERATION,
};

/** The BullMQ job name each queue's worker processes. */
export const ENRICHMENT_JOB_NAMES: Record<RecipeEnrichmentKind, string> = {
  "auto-tagging": "auto-tag",
  "allergy-detection": "allergy-detect",
  "auto-categorization": "auto-categorize",
  "nutrition-estimation": "estimate",
  "recipe-provenance": "infer-provenance",
  "ingredient-linking": "link-ingredients",
  "image-generation": "generate-image",
};

/**
 * Whether a retained job still occupies this recipe and kind.
 *
 * Only `queued` and `processing` block a new run. A completed or failed job
 * kept for history must not prevent a deliberate rerun, so retention never
 * looks like a permanently active job.
 */
export async function findActiveEnrichmentJobId(
  queue: Queue,
  kind: RecipeEnrichmentKind,
  recipeId: string
): Promise<string | null> {
  const jobId = enrichmentJobId(kind, recipeId);
  const job = await queue.getJob(jobId);

  if (!job) return null;

  const state = toEnrichmentLifecycleState(await job.getState());

  return state === "queued" || state === "processing" ? jobId : null;
}
