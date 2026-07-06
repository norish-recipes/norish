/**
 * Queue Operation Context
 *
 * Utilities for propagating operationId through BullMQ job boundaries.
 *
 * Producer side: `withJobOperationContext(jobData)` attaches the current operationId.
 * Worker side: `createContextAwareProcessor(processor)` restores it before processing.
 */

import type { Job, Processor } from "bullmq";

import type { OperationId } from "@norish/shared/contracts/realtime-envelope";
import {
  getCurrentOperationId,
  runWithOperationContext,
} from "@norish/shared-server/lib/operation-context";

/**
 * Metadata key used in job data to carry the operationId.
 * Using a prefixed key to avoid collisions with domain data.
 */
const OPERATION_ID_KEY = "__operationId" as const;

/** Job data shape with optional embedded operationId. */
export type WithOperationId<T> = T & { [OPERATION_ID_KEY]?: OperationId };

/**
 * Attach the current operationId to job data before enqueuing.
 * If there is no active operation context, the data is returned unchanged.
 *
 * @example
 * ```ts
 * const jobData = withJobOperationContext({
 *   recipeId: "abc",
 *   userId: "user1",
 *   householdKey: "hh1",
 * });
 * await queue.add("import", jobData, { jobId });
 * ```
 */
export function withJobOperationContext<T extends object>(data: T): WithOperationId<T> {
  const operationId = getCurrentOperationId();

  if (!operationId) return data as WithOperationId<T>;

  return { ...data, [OPERATION_ID_KEY]: operationId };
}

/**
 * Extract the operationId from job data without mutating the data.
 */
export function extractJobOperationId<T>(data: T): OperationId | undefined {
  if (data == null || typeof data !== "object") return undefined;

  return (data as Record<string, unknown>)[OPERATION_ID_KEY] as OperationId | undefined;
}

/**
 * Wrap a BullMQ job processor to restore the operation context before processing.
 *
 * This ensures that any events emitted during job processing will carry the
 * operationId that was attached when the job was enqueued.
 *
 * @example
 * ```ts
 * const worker = new Worker(
 *   QUEUE_NAME,
 *   createContextAwareProcessor(processImportJob),
 *   options
 * );
 * ```
 */
export function createContextAwareProcessor<T>(processor: Processor<T>): Processor<T> {
  return (job: Job<T>, token?: string) => {
    const operationId = extractJobOperationId(job.data);

    if (!operationId) {
      return processor(job, token);
    }

    return runWithOperationContext({ operationId }, () => processor(job, token));
  };
}
