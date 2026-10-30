import type { Job } from "bullmq";

import type { StoreLookupJobData } from "@norish/queue/contracts/job-types";
import { clearPendingLink } from "@norish/db/repositories/store-products";
import { createLogger } from "@norish/shared-server/logger";

import { createWorker, isFinalFailure } from "../create-worker";
import { completeStep, reportStep } from "../job-steps";
import { QUEUE_NAMES } from "../queue-names";
import { matchGroceryName, refreshProducts } from "./lookup";

const log = createLogger("worker:store-lookup");

async function processStoreLookup(job: Job<StoreLookupJobData>): Promise<void> {
  if (job.data.kind === "match") {
    const { storeId, ingredientId, name, householdKey } = job.data;

    await matchGroceryName({
      storeId,
      ingredientId,
      name,
      householdKey,
      onStep: (step) => reportStep(job, step),
      onStepDone: (detail) => completeStep(job, detail),
    });

    return;
  }

  await reportStep(job, "reading-product", { asked: job.data.productIds.length });
  const { refreshed } = await refreshProducts({
    productIds: job.data.productIds,
    householdKey: job.data.householdKey,
  });

  await completeStep(job, { refreshed });
  log.debug({ jobId: job.id, refreshed }, "Refreshed stale Shelf Prices");
}

/**
 * A lookup that gave up. A match job that has spent its attempts, or was
 * cancelled, leaves no Pending Link behind: the name is unknown again, and
 * the next view of the list asks. An attempt that will be retried leaves the
 * row where it is — the question is still being asked.
 */
export async function forgetFailedLookup(
  job: Pick<Job<StoreLookupJobData>, "data" | "attemptsMade" | "opts"> | undefined,
  error: Error
): Promise<void> {
  if (job?.data.kind !== "match") return;
  if (!isFinalFailure(job, error)) return;
  await clearPendingLink(job.data.storeId, job.data.ingredientId);
}

export function startStoreLookupWorker(): void {
  createWorker(QUEUE_NAMES.STORE_LOOKUP, processStoreLookup, { onFailed: forgetFailedLookup });
}
