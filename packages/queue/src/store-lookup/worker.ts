import type { Job } from "bullmq";
import { Worker } from "bullmq";

import type { StoreLookupJobData } from "@norish/queue/contracts/job-types";
import { clearPendingLink } from "@norish/db/repositories/store-products";
import { getBullClient } from "@norish/queue/redis/bullmq";
import { createLogger } from "@norish/shared-server/logger";

import { baseWorkerOptions, QUEUE_NAMES, STALLED_INTERVAL, WORKER_CONCURRENCY } from "../config";
import { reportStep } from "../job-steps";
import { matchGroceryName, refreshProducts } from "./lookup";

const log = createLogger("worker:store-lookup");

// Read on every access, never copied into a module-local — see the note on
// `globalForRegistry` in ../registry.ts. Here the cost of getting it wrong is a
// rival always-on worker that the first instance's shutdown cannot reach.
const globalForWorker = globalThis as unknown as {
  storeLookupWorker: Worker<StoreLookupJobData> | null;
};

async function processStoreLookup(job: Job<StoreLookupJobData>): Promise<void> {
  if (job.data.kind === "match") {
    const { storeId, name, householdKey } = job.data;

    await matchGroceryName({
      storeId,
      name,
      householdKey,
      onStep: (step) => reportStep(job, step),
    });

    return;
  }

  await reportStep(job, "searching");
  const { refreshed } = await refreshProducts({
    productIds: job.data.productIds,
    householdKey: job.data.householdKey,
  });

  log.debug({ jobId: job.id, refreshed }, "Refreshed stale Shelf Prices");
}

/**
 * A lookup that gave up. A match job that has spent its attempts leaves no
 * Pending Link behind: the name is unknown again, and the next view of the
 * list asks. An attempt that will be retried leaves the row where it is —
 * the question is still being asked.
 */
export async function forgetFailedLookup(
  job: Pick<Job<StoreLookupJobData>, "data" | "attemptsMade" | "opts"> | undefined
): Promise<void> {
  if (job?.data.kind !== "match") return;
  if (job.attemptsMade < (job.opts.attempts ?? 1)) return;
  await clearPendingLink(job.data.storeId, job.data.name);
}

/**
 * Always-on, concurrency 1. Always-on because a grocery must be priced while
 * the user is still looking at the list, and because a lazy worker is where
 * the `delay` trap lives; concurrency 1 because one visit at a time to
 * somebody else's supermarket is the whole good-citizen fence.
 */
export function startStoreLookupWorker(): void {
  if (globalForWorker.storeLookupWorker) return;

  const worker = new Worker<StoreLookupJobData>(QUEUE_NAMES.STORE_LOOKUP, processStoreLookup, {
    connection: getBullClient(),
    ...baseWorkerOptions,
    stalledInterval: STALLED_INTERVAL[QUEUE_NAMES.STORE_LOOKUP],
    concurrency: WORKER_CONCURRENCY[QUEUE_NAMES.STORE_LOOKUP],
  });

  worker.on("failed", (job, error) => {
    log.error({ jobId: job?.id, err: error }, "Store lookup failed");
    forgetFailedLookup(job).catch((err: unknown) => {
      log.error({ jobId: job?.id, err }, "Failed to clear a Pending Link");
    });
  });

  worker.on("error", (error) => {
    log.error({ err: error }, "Store lookup worker error");
  });

  globalForWorker.storeLookupWorker = worker;
  log.info("Store lookup worker started");
}

export async function stopStoreLookupWorker(): Promise<void> {
  const worker = globalForWorker.storeLookupWorker;

  if (worker) {
    worker.removeAllListeners();
    await worker.close();
    globalForWorker.storeLookupWorker = null;
    log.info("Store lookup worker stopped");
  }
}
