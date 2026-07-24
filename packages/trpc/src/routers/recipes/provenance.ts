import type { JobState, JobType } from "bullmq";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import type { ProvenanceStatus } from "@norish/shared/lib/provenance";
import { provenanceJobId } from "@norish/queue/provenance/producer";
import { getQueues } from "@norish/queue/registry";
import { trpcLogger as log } from "@norish/shared-server/logger";
import { recipeHasProvenance } from "@norish/shared/lib/provenance";

import { authedProcedure } from "../../middleware";
import { router } from "../../trpc";
import { findRecipeForViewer } from "./helpers";

const ProvenanceStatusSchema = z.enum([
  "idle",
  "queued",
  "processing",
  "succeeded",
  "failed",
]);

/**
 * Map a deterministic provenance job's BullMQ state to the authoritative status.
 * When there is no job (never queued, or aged out of retention), fall back to
 * whether the recipe already carries provenance so the panel resolves without a
 * live job — `succeeded` if enriched, otherwise `idle`.
 */
export function provenanceStatusFromJobState(
  state: JobState | JobType | "unknown" | undefined,
  hasProvenance: boolean
): ProvenanceStatus {
  switch (state) {
    case "active":
      return "processing";
    case "completed":
      return "succeeded";
    case "failed":
      return "failed";
    case "waiting":
    case "waiting-children":
    case "delayed":
    case "prioritized":
      return "queued";
    default:
      return hasProvenance ? "succeeded" : "idle";
  }
}

/**
 * Authoritative snapshot of a recipe's provenance inference. Requires recipe
 * VIEW access (a private recipe is hidden as NOT_FOUND). The status is derived
 * from the deterministic per-recipe queue job when present, falling back to
 * whether the recipe already carries provenance once the job has aged out of
 * retention — so the panel never spins indefinitely.
 */
const provenanceStatus = authedProcedure
  .input(z.object({ recipeId: z.uuid() }))
  .output(z.object({ status: ProvenanceStatusSchema }))
  .query(async ({ ctx, input }) => {
    const recipe = await findRecipeForViewer(ctx, input.recipeId);

    if (!recipe) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Recipe not found" });
    }

    const hasProvenance = recipeHasProvenance(recipe);

    const queues = getQueues();
    const job = await queues.provenance.getJob(provenanceJobId(input.recipeId));
    const state = job ? await job.getState() : undefined;
    const status = provenanceStatusFromJobState(state, hasProvenance);

    log.debug({ userId: ctx.user.id, recipeId: input.recipeId, status }, "Read provenance status");

    return { status };
  });

export const provenanceProcedures = router({ provenanceStatus });
