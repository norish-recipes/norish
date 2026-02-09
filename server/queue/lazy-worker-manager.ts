/**
 * Lazy Worker Manager
 *
 * Manages BullMQ workers that start on-demand when jobs are added
 * and shut down after extended idle to save memory and CPU.
 *
 * Two-phase idle strategy:
 * - Warm idle (30s): Worker pauses but stays in memory (fast restart)
 * - Cold shutdown (5min): Worker is destroyed to free memory
 *
 * Use this for workers that handle infrequent, user-triggered jobs.
 * Do NOT use for scheduled/cron jobs (use regular workers instead).
 */

import type { Job, Processor, WorkerOptions } from "bullmq";
import type { ConnectionOptions } from "bullmq";

import { Worker, QueueEvents, Queue } from "bullmq";

import { createLogger } from "@/server/logger";

const log = createLogger("lazy-worker");

/**
 * How long to wait after queue drains before pausing the worker.
 * This prevents rapid start/stop cycles when jobs arrive in quick succession.
 */
const WARM_IDLE_TIMEOUT_MS = 30_000; // 30 seconds - pause worker

/**
 * How long to wait in paused state before cold shutdown.
 * After this, worker is destroyed to free memory.
 */
const COLD_SHUTDOWN_TIMEOUT_MS = 300_000; // 5 minutes - destroy worker

/**
 * Polling interval to catch any jobs that might have been missed due to
 * Redis pub/sub message loss or race conditions during initialization.
 */
const POLLING_INTERVAL_MS = 3_600_000; // 1 hour

interface LazyWorkerConfig<T> {
  queueName: string;
  processor: Processor<T>;
  options: WorkerOptions;
  onFailed?: (job: Job<T> | undefined, error: Error) => void | Promise<void>;
}

interface LazyWorkerState<T> {
  config: LazyWorkerConfig<T>;
  worker: Worker<T> | null;
  queue: Queue<T> | null; // For checking job counts
  queueEvents: QueueEvents | null;
  isRunning: boolean;
  warmIdleTimer: NodeJS.Timeout | null;
  coldShutdownTimer: NodeJS.Timeout | null;
  pollingTimer: NodeJS.Timeout | null;
  operationLock: Promise<void>; // Mutex for state transitions
}

// Use globalThis to survive HMR in development
const globalForLazyWorkers = globalThis as unknown as {
  lazyWorkerRegistry: Map<string, LazyWorkerState<unknown>> | undefined;
};

function getWorkerRegistry(): Map<string, LazyWorkerState<unknown>> {
  if (!globalForLazyWorkers.lazyWorkerRegistry) {
    globalForLazyWorkers.lazyWorkerRegistry = new Map();
  }

  return globalForLazyWorkers.lazyWorkerRegistry;
}

/**
 * Create a lazy worker that starts on-demand and shuts down when idle.
 *
 * @param queueName - The name of the queue to process
 * @param processor - The job processor function
 * @param options - Worker options (connection is required)
 * @param onFailed - Optional callback for failed jobs
 *
 * @example
 * ```ts
 * createLazyWorker(
 *   QUEUE_NAMES.RECIPE_IMPORT,
 *   processImportJob,
 *   {
 *     connection: getBullClient(),
 *     concurrency: 2,
 *     stalledInterval: 30_000,
 *   },
 *   handleJobFailed
 * );
 * ```
 */
export async function createLazyWorker<T>(
  queueName: string,
  processor: Processor<T>,
  options: WorkerOptions,
  onFailed?: (job: Job<T> | undefined, error: Error) => void | Promise<void>
): Promise<void> {
  const registry = getWorkerRegistry();

  // Prevent duplicate workers
  if (registry.has(queueName)) {
    log.warn({ queueName }, "Lazy worker already exists for this queue");

    return;
  }

  const config: LazyWorkerConfig<T> = {
    queueName,
    processor,
    options,
    onFailed,
  };

  const state: LazyWorkerState<T> = {
    config,
    worker: null,
    queue: null,
    queueEvents: null,
    isRunning: false,
    warmIdleTimer: null,
    coldShutdownTimer: null,
    pollingTimer: null,
    operationLock: Promise.resolve(),
  };

  registry.set(queueName, state as LazyWorkerState<unknown>);

  // Create QueueEvents to listen for job arrivals
  await initializeQueueEvents(state);

  log.info({ queueName }, "Lazy worker registered (waiting for jobs)");
}

/**
 * Initialize QueueEvents listener for a lazy worker.
 */
async function initializeQueueEvents<T>(state: LazyWorkerState<T>): Promise<void> {
  const { queueName, options } = state.config;
  const connection = options.connection as ConnectionOptions;

  // Create Queue instance for job count checking
  const queue = new Queue<T>(queueName, { connection });

  state.queue = queue;

  const queueEvents = new QueueEvents(queueName, { connection });

  // CRITICAL: Wait for Redis connection before listening for events
  await queueEvents.waitUntilReady();

  state.queueEvents = queueEvents;

  // CRITICAL: Check for existing waiting jobs BEFORE attaching event listeners
  // This eliminates the race condition where jobs could be added between
  // waitUntilReady() and the 'waiting' event listener attachment
  const initialCounts = await queue.getJobCounts("waiting");

  if (initialCounts.waiting > 0) {
    log.info(
      { queueName, waiting: initialCounts.waiting },
      "Found existing waiting jobs during init, starting worker"
    );
    await ensureWorkerRunning(state);
  }

  // Use 'waiting' event - more reliable than 'added'
  // 'waiting' fires when job is ready to be processed
  queueEvents.on("waiting", ({ jobId }) => {
    log.debug({ queueName, jobId }, "Job waiting, ensuring worker is running");
    clearAllTimers(state);
    // CRITICAL: Await ensureWorkerRunning to prevent race conditions
    void ensureWorkerRunning(state).catch((err) => {
      log.error({ err, queueName }, "Failed to ensure worker running on waiting event");
    });
  });

  // Set idle timer when queue empties
  queueEvents.on("drained", () => {
    log.debug({ queueName }, "Queue drained, checking if safe to idle");
    scheduleWarmIdle(state);
  });

  // Start periodic polling as a safety net for missed events
  startPolling(state);
}

/**
 * Ensure the worker is running. Creates if needed, resumes if paused.
 * Uses mutex to prevent race conditions during state transitions.
 */
async function ensureWorkerRunning<T>(state: LazyWorkerState<T>): Promise<void> {
  const { queueName } = state.config;

  // Use mutex to prevent concurrent state modifications
  const previousLock = state.operationLock;
  let releaseLock: () => void;

  state.operationLock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });

  try {
    await previousLock;

    // Already running and not paused
    if (state.worker && state.isRunning && !state.worker.isPaused()) {
      return;
    }

    // Worker exists but is paused - resume it
    if (state.worker && state.worker.isPaused()) {
      log.info({ queueName }, "Resuming paused lazy worker");

      try {
        await state.worker.resume();
        state.isRunning = true;
      } catch (err) {
        log.error({ err, queueName }, "Failed to resume lazy worker, recreating");
        await destroyWorker(state);
        await createWorkerInstance(state);
      }

      return;
    }

    // No worker exists - create one
    if (!state.worker) {
      await createWorkerInstance(state);
    }
  } finally {
    releaseLock!();
  }
}

/**
 * Create a new worker instance and start it.
 */
async function createWorkerInstance<T>(state: LazyWorkerState<T>): Promise<void> {
  const { queueName, processor, options, onFailed } = state.config;

  log.info({ queueName }, "Creating lazy worker instance");

  const worker = new Worker<T>(queueName, processor, {
    ...options,
    autorun: false, // Don't start processing immediately
  });

  state.worker = worker;

  // Attach event handlers
  worker.on("completed", (job) => {
    log.debug({ queueName, jobId: job.id }, "Job completed");
  });

  worker.on("failed", (job, error) => {
    log.error({ queueName, jobId: job?.id, error: error.message }, "Job failed");
    if (onFailed) {
      Promise.resolve(onFailed(job, error)).catch((err) => {
        log.error({ err, queueName }, "onFailed handler threw error");
      });
    }
  });

  worker.on("error", (error) => {
    log.error({ err: error, queueName }, "Lazy worker error");
  });

  // Start processing
  try {
    await worker.run();
    state.isRunning = true;
    log.info({ queueName }, "Lazy worker started");
  } catch (err) {
    log.error({ err, queueName }, "Failed to start lazy worker");
    state.isRunning = false;
  }
}

/**
 * Destroy the worker instance to free memory.
 */
async function destroyWorker<T>(state: LazyWorkerState<T>): Promise<void> {
  const { queueName } = state.config;

  if (!state.worker) {
    return;
  }

  log.info({ queueName }, "Destroying lazy worker instance");

  try {
    state.worker.removeAllListeners();
    await state.worker.close();
  } catch (err) {
    log.error({ err, queueName }, "Error closing lazy worker");
  }

  state.worker = null;
  state.isRunning = false;
}

/**
 * Clear all idle timers.
 */
function clearAllTimers<T>(state: LazyWorkerState<T>): void {
  if (state.warmIdleTimer) {
    clearTimeout(state.warmIdleTimer);
    state.warmIdleTimer = null;
  }

  if (state.coldShutdownTimer) {
    clearTimeout(state.coldShutdownTimer);
    state.coldShutdownTimer = null;
  }
}

/**
 * Start periodic polling as a safety net for missed Redis events.
 * Checks every hour for any waiting jobs that might have been missed.
 */
function startPolling<T>(state: LazyWorkerState<T>): void {
  const { queueName } = state.config;

  // Clear existing polling timer if any
  if (state.pollingTimer) {
    clearInterval(state.pollingTimer);
  }

  state.pollingTimer = setInterval(async () => {
    if (!state.queue) return;

    try {
      const counts = await state.queue.getJobCounts("waiting");

      if (counts.waiting > 0) {
        log.info(
          { queueName, waiting: counts.waiting },
          "Polling: found waiting jobs, ensuring worker is running"
        );
        await ensureWorkerRunning(state);
      }
    } catch (err) {
      log.error({ err, queueName }, "Polling: failed to check job counts");
    }
  }, POLLING_INTERVAL_MS);

  log.debug({ queueName, intervalMs: POLLING_INTERVAL_MS }, "Started polling safety net");
}

/**
 * Stop polling for a lazy worker.
 */
function stopPolling<T>(state: LazyWorkerState<T>): void {
  if (state.pollingTimer) {
    clearInterval(state.pollingTimer);
    state.pollingTimer = null;
  }
}

/**
 * Schedule warm idle (pause) after queue drains.
 * Only pauses if no active or waiting jobs remain.
 */
function scheduleWarmIdle<T>(state: LazyWorkerState<T>): void {
  const { queueName } = state.config;

  // Clear existing timers
  clearAllTimers(state);

  state.warmIdleTimer = setTimeout(async () => {
    if (!state.worker || !state.queue || !state.isRunning) {
      return;
    }

    // Check if jobs are still active before pausing
    try {
      const counts = await state.queue.getJobCounts("active", "waiting");

      if (counts.active > 0 || counts.waiting > 0) {
        log.debug(
          { queueName, active: counts.active, waiting: counts.waiting },
          "Jobs still present, skipping warm idle"
        );

        return;
      }

      // Safe to pause
      if (!state.worker.isPaused()) {
        log.info({ queueName }, "Warm idle: pausing lazy worker");
        // Set isRunning=false BEFORE pause() to prevent race with ensureWorkerRunning
        state.isRunning = false;
        await state.worker.pause();

        // Schedule cold shutdown
        scheduleColdShutdown(state);
      }
    } catch (err) {
      log.error({ err, queueName }, "Error during warm idle check");
    }
  }, WARM_IDLE_TIMEOUT_MS);
}

/**
 * Schedule cold shutdown (destroy) after extended idle.
 * Frees memory by destroying the worker entirely.
 */
function scheduleColdShutdown<T>(state: LazyWorkerState<T>): void {
  const { queueName } = state.config;

  state.coldShutdownTimer = setTimeout(async () => {
    if (!state.worker || !state.queue) {
      return;
    }

    // Double-check no jobs arrived while we were waiting
    try {
      const counts = await state.queue.getJobCounts("active", "waiting");

      if (counts.active > 0 || counts.waiting > 0) {
        log.debug(
          { queueName, active: counts.active, waiting: counts.waiting },
          "Jobs arrived during cold idle, resuming"
        );
        await ensureWorkerRunning(state);

        return;
      }

      // Safe to destroy
      log.info({ queueName }, "Cold shutdown: destroying lazy worker to free memory");
      await destroyWorker(state);
    } catch (err) {
      log.error({ err, queueName }, "Error during cold shutdown");
    }
  }, COLD_SHUTDOWN_TIMEOUT_MS);
}

/**
 * Stop a specific lazy worker.
 */
export async function stopLazyWorker(queueName: string): Promise<void> {
  const registry = getWorkerRegistry();
  const state = registry.get(queueName);

  if (!state) {
    log.debug({ queueName }, "No lazy worker to stop");

    return;
  }

  log.info({ queueName }, "Stopping lazy worker");

  clearAllTimers(state);
  stopPolling(state as LazyWorkerState<unknown>);

  // Destroy worker
  await destroyWorker(state as LazyWorkerState<unknown>);

  // Close Queue (used for job counts)
  if (state.queue) {
    try {
      await state.queue.close();
    } catch (err) {
      log.error({ err, queueName }, "Error closing queue");
    }

    state.queue = null;
  }

  // Close QueueEvents
  if (state.queueEvents) {
    try {
      state.queueEvents.removeAllListeners();
      await state.queueEvents.close();
    } catch (err) {
      log.error({ err, queueName }, "Error closing queue events");
    }

    state.queueEvents = null;
  }

  registry.delete(queueName);
  log.info({ queueName }, "Lazy worker stopped");
}

/**
 * Stop all lazy workers.
 * Call during server shutdown.
 */
export async function stopAllLazyWorkers(): Promise<void> {
  const registry = getWorkerRegistry();

  if (registry.size === 0) {
    log.debug("No lazy workers to stop");

    return;
  }

  log.info({ count: registry.size }, "Stopping all lazy workers");

  const stopPromises = Array.from(registry.keys()).map((queueName) => stopLazyWorker(queueName));

  await Promise.all(stopPromises);

  log.info("All lazy workers stopped");
}
