/**
 * The one way a worker starts. Every queue has an always-on worker from boot,
 * so a retry waiting out its backoff runs when the backoff ends, and a retry
 * pending across a restart runs after it.
 *
 * A worker started here:
 * - runs its processor inside the operation context the job was enqueued
 *   under and a model-use ledger the AI Runtime records into, so no worker
 *   can miss the job monitor's AI-model chip
 * - logs its errors and failed jobs through the server logger
 * - is registered for shutdown
 * - passes its processor BullMQ's abort signal as a third parameter, which
 *   BullMQ only creates for a processor that declares three parameters
 *
 * A job stops where it checks that signal: the AI Runtime, which binds every
 * request a job makes to it, and, for an administrator's cancel, the job's
 * next step report. A job the signal stopped is answered by who stopped it.
 * An administrator's cancel fails it for good (**Cancelled**), even when it
 * finished the step it was on; a shutdown puts it back to waiting without
 * spending an attempt, so the next boot runs it first.
 */

import type { Job, Processor } from "bullmq";
import { UnrecoverableError, WaitingError, Worker } from "bullmq";

import { createLogger } from "@norish/shared-server/logger";

import type { QueueName } from "./queue-names";
import { baseWorkerOptions, QUEUE_SETTINGS } from "./config";
import { stopAtNextStepOnceCancelled } from "./job-steps";
import { createModelLedgerProcessor } from "./model-ledger-processor";
import { createContextAwareProcessor } from "./queue-operation-context";
import { getBullClient } from "./valkey/bullmq";

const log = createLogger("worker");

/** What a job an administrator cancelled fails with. */
const CANCELLED_BY_ADMINISTRATOR = "Cancelled by an administrator";

/** The reason shutdown aborts the running jobs with. */
const SHUTDOWN = "Norish is shutting down";

interface StartedWorker {
  worker: Worker;
  /**
   * The jobs this worker is running, by id, each resolved once BullMQ has
   * recorded what became of the job, which it does after the processor returns.
   */
  running: Map<string | undefined, { recorded: Promise<void>; resolve: () => void }>;
}

// Read on every access, never copied into a module-local — see the note on
// `globalForRegistry` in ./registry.ts for why this module is evaluated more
// than once per process. Here the cost of getting it wrong is a rival worker
// that shutdown cannot reach.
const globalForWorkers = globalThis as unknown as {
  workers: Map<QueueName, StartedWorker> | undefined;
};

function workers(): Map<QueueName, StartedWorker> {
  return (globalForWorkers.workers ??= new Map());
}

export interface CreateWorkerOptions<T> {
  /** The queue's own failure policy, run after every failed attempt. */
  onFailed?: (job: Job<T> | undefined, error: Error) => void | Promise<void>;
}

export function createWorker<T>(
  queueName: QueueName,
  processor: Processor<T>,
  options: CreateWorkerOptions<T> = {}
): Worker<T> {
  if (workers().has(queueName)) {
    throw new Error(`A worker for ${queueName} has already started`);
  }

  const running: StartedWorker["running"] = new Map();
  const recorded = (jobId: string | undefined) => {
    running.get(jobId)?.resolve();
    running.delete(jobId);
  };
  const instrumented = createContextAwareProcessor(createModelLedgerProcessor(processor));
  const settle = async (job: Job<T>, token?: string, signal?: AbortSignal) => {
    const cancelled = () => signal?.aborted === true && signal.reason !== SHUTDOWN;
    let result: unknown;

    stopAtNextStepOnceCancelled(job, cancelled);
    try {
      result = await instrumented(job, token, signal);
    } catch (err) {
      if (!signal?.aborted) throw err;
      if (signal.reason === SHUTDOWN) {
        // With Valkey unreachable the job stays active, and the next boot's
        // stalled-job check puts it back.
        await job.moveToWait(token).catch((moveErr: unknown) => {
          log.warn(
            { err: moveErr, queueName, jobId: job.id },
            "Could not put a job back to waiting"
          );
        });
        recorded(job.id);
        throw new WaitingError();
      }
    }
    if (cancelled()) throw new UnrecoverableError(CANCELLED_BY_ADMINISTRATOR);

    return result;
  };
  const worker = new Worker<T>(
    queueName,
    // Three parameters, or BullMQ creates no abort signal.
    async (job, token, signal) => {
      let resolve = () => {};
      const outcome = new Promise<void>((settled) => (resolve = settled));

      running.set(job.id, { recorded: outcome, resolve });

      return settle(job, token, signal);
    },
    {
      connection: getBullClient(),
      ...baseWorkerOptions,
      stalledInterval: QUEUE_SETTINGS[queueName].stalledInterval,
      concurrency: QUEUE_SETTINGS[queueName].concurrency,
    }
  );

  worker.on("error", (err) => {
    log.error({ err, queueName }, "Worker error");
  });

  worker.on("completed", (job) => recorded(job.id));

  worker.on("failed", (job, err) => {
    recorded(job?.id);
    log.error(
      {
        err,
        queueName,
        jobId: job?.id,
        attempt: job?.attemptsMade,
        final: job ? isFinalFailure(job, err) : undefined,
      },
      "Job failed"
    );
    if (!options.onFailed) return;
    Promise.resolve()
      .then(() => options.onFailed?.(job, err))
      .catch((handlerErr: unknown) => {
        log.error({ err: handlerErr, queueName, jobId: job?.id }, "Failure handler threw");
      });
  });

  workers().set(queueName, { worker: worker as Worker, running });

  return worker;
}

/** Whether a job ended because an administrator cancelled it: BullMQ keeps it as failed. */
export function isCancelled(job: Pick<Job, "failedReason">): boolean {
  return job.failedReason === CANCELLED_BY_ADMINISTRATOR;
}

/**
 * Whether a failed attempt was the job's last: its attempts are spent, or it
 * failed for good, as a cancelled job does.
 */
export function isFinalFailure(job: Pick<Job, "attemptsMade" | "opts">, error: Error): boolean {
  return job.attemptsMade >= (job.opts.attempts ?? 1) || error instanceof UnrecoverableError;
}

/**
 * Cancel a job this process is running. False when none of its workers is
 * running it: the job finished, or it was left active by a previous process.
 */
export function cancelRunningJob(queueName: QueueName, jobId: string): boolean {
  return workers().get(queueName)?.worker.cancelJob(jobId, CANCELLED_BY_ADMINISTRATOR) ?? false;
}

/**
 * Close every worker. Each stops taking jobs at once, and its running jobs
 * are aborted: one stopped mid-request goes back to waiting, and one that does
 * not check the signal gets until the budget runs out to finish and have
 * BullMQ record that it did. Then the workers are closed by force, and a job
 * still running stays active for the next boot's stalled-job check.
 * Always by force in the end: BullMQ's graceful close also waits for whatever
 * command its run loop has in flight, which after a Valkey restart can sit on a
 * half-open socket until the socket timeout.
 */
export async function closeWorkers(budgetMs: number): Promise<void> {
  const started = [...workers().values()];

  workers().clear();
  await Promise.all(started.map(({ worker }) => worker.pause(true)));
  for (const { worker } of started) worker.cancelAllJobs(SHUTDOWN);

  let timer: NodeJS.Timeout | undefined;
  const budget = new Promise<void>((resolve) => (timer = setTimeout(resolve, budgetMs)));
  const finished = Promise.all(
    started.flatMap(({ running }) => [...running.values()].map(({ recorded }) => recorded))
  );

  await Promise.race([finished, budget]);
  clearTimeout(timer);
  await Promise.all(started.map(({ worker }) => worker.close(true)));
}
