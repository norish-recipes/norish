# 01: Every worker runs always-on, started through `createWorker`

**What to build:** Every background queue has a worker running from boot, so a retry waiting out its backoff runs when the backoff ends, even if nothing else is ever added to that queue, and a retry pending across a restart runs after it.

All sixteen workers start one way, including the two built by hand today (scheduled tasks and store lookup). That one way does four things:

- wraps the processor in the operation context and the model ledger, so no worker can miss the job monitor's AI-model chip again
- logs worker errors through the server logger
- registers the worker for shutdown
- passes the processor BullMQ's abort signal as a third parameter

The lazy-worker manager and `defineLazyWorker` are deleted with no alias. See `.scratch/architecture-after-upgrades/spec.md`, Background jobs.

Shutdown bounds its close by force-closing the workers once the budget runs out. No BullMQ connection sets `commandTimeout`: in ioredis 6 it also applies to the worker's blocking wait for its next job, which lasts up to `drainDelay` (5 s), so it would fail every idle wait. See the spec, Background jobs, Shutdown has a bounded close.

**Blocked by:** None within this spec. The branch starts from the rc once `chore/dependency-upgrades` has merged, so the `drainDelay` fix (the sweep's ticket 51) and the half-open Redis work (34, 35) are already in.

**Status:** ready-for-agent

- [x] A small, non-lazy `createWorker(queue, processor, options)` in the queue package is the only way a worker starts, and it does exactly the four things above.
- [x] All sixteen workers start through it at boot.
- [x] The lazy-worker manager, `defineLazyWorker`, the boot-time lazy registration, the store-lookup "delay trap" guard and the lazy-worker test files are deleted.
- [x] No module outside the registry constructs a `Queue`.
- [x] An idle server holds one blocking Redis connection per worker and no QueueEvents connections. Record the `CLIENT LIST` count in this ticket.
- [x] Real-Redis tests (a Redis testcontainer, as the scheduled-tasks producer test does):
  - [x] A job that fails once and retries with a backoff runs again when the backoff ends, with no other job added to the queue.
  - [x] A worker `error` reaches the logger.
  - [x] The processor receives an abort signal.
  - [x] Every processor runs inside the operation context and the model ledger.
  - [x] Every real-Redis test connects through the production connection options and the shared Redis image constant from the sweep's ticket 34, and adds no `vi.clearAllMocks()` (Vitest 5's default, the sweep's ticket 31).
- [x] Shutdown closes every worker. The shutdown step still names itself in the log if it runs slow.
- [x] Once the shutdown budget runs out, the workers are force-closed (`worker.close(true)`). No BullMQ connection sets `commandTimeout`; if the sweep's ticket 35 landed one, it is replaced by the force-close.
- [x] The sweep's ticket 35 regression still passes: `realtime.e2e.ts` runs the Redis restart before the server restart, and the shutdown log names no step over budget.
- [x] The E2E suite passes against a fresh `pnpm build`, including the job monitor's AI-model chip in the decision-model spec.
- [x] Release notes, under Fixes and Improvements: "A recipe import or calendar sync that failed and is due to retry now retries as soon as its wait is over. Before, the retry did not run until another import or sync was started, even after a restart." The maintainer will rewrite it.

## Comments

- 2026-10-14, implemented:
  - `packages/queue/src/create-worker.ts` holds `createWorker` and `closeWorkers`. Its options take the queue's `onFailed` policy, run after every failed attempt with its errors logged; failed jobs are logged there too, as the lazy manager did. Concurrency and the stalled interval still come from `config.ts` by queue name. A second worker for the same queue throws.
  - `instrumented-processor.ts` and `close-worker.ts` went with the lazy manager: their composition and the running-job bookkeeping now live in `createWorker`. Each worker module exports only its `start…Worker()`; the per-worker stop functions and their `@norish/queue` re-exports are gone, since shutdown closes every worker through the registry.
  - `closeWorkers(budget)` pauses every worker without waiting, so none takes another job; it waits for the running jobs up to the budget, then calls `close(true)` on all of them. It has to decide before calling close, because BullMQ's `close()` memoises its first call, so a later `close(true)` would only return the pending graceful close. `stopWorkers` gives it 20 s, inside the shutdown step's 30.
  - The one `Queue` built outside a factory the registry calls was the lazy manager's own, which is deleted. The scheduled-tasks and store-lookup factories still build a plain `Queue`, but only the registry calls them; ticket 04 routes their options through one place.
  - `CLIENT LIST` on an idle dev server (`tsx server/index.ts` against the local stack), 15 s after "Server ready": **19 connections.** That is the publisher, the Realtime Hub, the shared BullMQ client (`norish:<pid>:bull`) and 16 blocking `bzpopmin` connections, one per queue, with no QueueEvents. SIGTERM then shut it down in 0.2 s with no slow step logged.
  - Tests: `__tests__/queue/create-worker-redis.test.ts` covers the retry after its backoff, the error log, the signal with the context and ledger, the wait within the budget, and the force-close after it. `__tests__/redis/bullmq-redis.test.ts` (half-open close) now goes through `createWorker` and `closeWorkers`. The two hand-built workers' "wraps its own processor" tests are deleted, because `createWorker` now owns that property.
- 2026-10-14. Both E2E items: the full browser suite passed against a fresh build on 2026-10-14: 181 of 181, no flaky test. `realtime.e2e.ts` runs the Redis restart before the server restart, and asserts the captured server log has no "Shutdown step is slow" line; the decision-model spec with the job monitor's AI-model chip is in the `ai` project.
- 2026-10-15, from the branch review: a failed job is logged once, by `createWorker`, with its attempt and whether it was the last; the per-queue `onFailed` copies are gone. Shutdown now waits for BullMQ to record a job that finished inside the budget: `closeWorkers` force-closed as soon as the processor returned, so such a job stayed active and ran again at the next boot (found when the timing tests went deterministic, 5 of 5 failing before the fix).
