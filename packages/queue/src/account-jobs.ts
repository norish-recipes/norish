// A job carries its account's id, an import also what it sent (photos, text, a URL): once the
// account is gone its jobs end quietly, and none is kept, waiting or retained.

import type { Job, Processor } from "bullmq";
import { UnrecoverableError } from "bullmq";

import { getHouseholdIdForUser } from "@norish/db/repositories/households";
import { createLogger } from "@norish/shared-server/logger";

import type { QueueName } from "./queue-names";
import { QUEUE_NAMES } from "./queue-names";

const log = createLogger("queue:account-jobs");

/** The queues whose jobs carry an account's id: imports, CalDAV, enrichment and Enrich All. */
export const ACCOUNT_QUEUES: readonly QueueName[] = [
  QUEUE_NAMES.RECIPE_IMPORT,
  QUEUE_NAMES.IMAGE_IMPORT,
  QUEUE_NAMES.PASTE_IMPORT,
  QUEUE_NAMES.CALDAV_SYNC,
  QUEUE_NAMES.NUTRITION_ESTIMATION,
  QUEUE_NAMES.AUTO_TAGGING,
  QUEUE_NAMES.AUTO_CATEGORIZATION,
  QUEUE_NAMES.ALLERGY_DETECTION,
  QUEUE_NAMES.RECIPE_PROVENANCE,
  QUEUE_NAMES.INGREDIENT_LINKING,
  QUEUE_NAMES.IMAGE_GENERATION,
  QUEUE_NAMES.ENRICH_ALL,
];

/** What a job of a deleted account fails with: for good, and logged as the quiet end it is. */
export class AccountGoneError extends UnrecoverableError {
  constructor() {
    super("The account was deleted");
  }
}

function accountOf(queueName: QueueName, job: Job): string | null {
  const { userId } = (job.data ?? {}) as { userId?: unknown };

  return ACCOUNT_QUEUES.includes(queueName) && typeof userId === "string" ? userId : null;
}

const isGone = async (userId: string) => !(await getHouseholdIdForUser(userId));

/** Fails a job of a deleted account for good: before it runs, and when it fails as its account goes. */
export function endingWithItsAccount<T>(
  queueName: QueueName,
  processor: Processor<T>
): Processor<T> {
  return async (job, token, signal) => {
    const userId = accountOf(queueName, job);

    if (!userId) return processor(job, token, signal);
    if (await isGone(userId)) throw new AccountGoneError();

    try {
      return await processor(job, token, signal);
    } catch (error) {
      if (await isGone(userId)) throw new AccountGoneError();
      throw error;
    }
  };
}

/** A job that settled after its account went is removed, so its retention keeps no payload. */
export async function removeIfAccountGone(queueName: QueueName, job: Job | undefined) {
  const userId = job ? accountOf(queueName, job) : null;

  if (!job || !userId || !(await isGone(userId))) return;
  await job
    .remove()
    .catch((err: unknown) => log.warn({ err, queueName, jobId: job.id }, "Could not remove a job"));
}
