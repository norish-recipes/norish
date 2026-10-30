# 03: An administrator cancels a running job

**What to build:**

- An administrator watching a running job in the job monitor can cancel it:
  - The button reads "Cancelling…" until the job has stopped.
  - The job then shows as **Cancelled**, with a note that an administrator stopped it.
  - It never retries.
  - An AI call in flight is aborted at once. Non-AI work finishes its current step first.
  - Cancel is offered for running jobs on every queue.
- A server restart aborts AI calls in flight too, but those jobs go back to waiting and run first on the next boot, without using up a retry: a restart is neither a cancel nor a failure.

See `.scratch/architecture-after-upgrades/spec.md`, Background jobs, Cancellation, and CONTEXT.md's **Cancelled**.

**Blocked by:** 01 (`createWorker` passes the abort signal on)

**Status:** ready-for-agent

- [x] The AI Runtime accepts an abort signal and passes it to the transport for every entry point (structured generation, transcription, image generation, Decision). Features pass the processor's signal through.
- [x] A new admin procedure cancels an active job through the worker's `cancelJob(jobId, reason)`. The existing remove action still refuses active jobs.
- [x] The processor wrapper turns an admin-cancel abort into BullMQ's `UnrecoverableError`, with a reason that records that an administrator stopped the job.
- [x] Shutdown calls `cancelAllJobs()` with a shutdown reason, before closing the workers. The wrapper answers that abort with `job.moveToWait(token)` and throws BullMQ's `WaitingError`, so the job goes back to waiting without spending an attempt or waiting out a backoff. If Redis is unreachable and `moveToWait` fails, the job stays active and BullMQ's stalled-job check recovers it on the next boot.
- [x] The job monitor shows a Cancelled state, distinct from failed, and a cancel action on active jobs that reads "Cancelling…" until the run it was asked for leaves `active` (a retried run offers Cancel again, fixed 2026-10-15). Copy goes through the message catalogue in every shipped language.
- [x] Real-Redis tests:
  - [x] Admin cancel of an active job ends it failed, with no further attempt and with the administrator's reason.
  - [x] Shutdown cancel puts the job back to waiting with `attemptsMade` unchanged, and a worker started afterwards runs it.
  - [x] Both connect through the production connection options and the shared Redis image constant from the sweep's ticket 34.
- [x] An AI Runtime unit test proves the signal reaches the transport.
- [x] A browser E2E (next to the job monitor coverage in the decision-model spec): an administrator cancels a running AI job and sees it Cancelled.
- [x] Release notes, under Features: administrators can cancel a running background job. The admin settings docs page shows it, with a screenshot.

## Comments

- 2026-10-14, implemented:
  - **How the signal reaches the runtime.** It rides the model-use ledger's AsyncLocalStorage instead of a parameter on every feature, which is the "one change there" the spec names.
    - `createModelUseLedger(signal)` carries the job's signal, and a ledger opened inside another keeps it; the review round opens one per food.
    - Every entry point's `AbortSignal.timeout(…)` became `requestSignal(timeoutMs)`, which is the deadline combined with the job's signal through `AbortSignal.any`. That covers structured generation, transcription (all three routes, Ollama included), image generation and Decision.
    - An aborted job's next request is refused before it is sent.
  - **The wrapper** (`createWorker`) answers only a processor that threw while its signal was aborted:
    - the shutdown reason gives `moveToWait` and then `WaitingError`; if `moveToWait` fails, it is logged and `WaitingError` is still thrown, so the job stays active
    - any other reason gives `UnrecoverableError("Cancelled by an administrator")`
    - a processor that swallowed the abort, through a fallback, and resolved completes as itself; marking it Cancelled after its writes would be untrue
  - **Shutdown order** in `closeWorkers`: pause every worker, so no next job is fetched, not even after a `WaitingError`; then `cancelAllJobs`; then wait out the budget; then `close(true)`.
  - **Rounds check the signal between foods.** Ask AI (`ingredient-review`), Draw icons and New ingredients catch each food's error and go on, so without a check a cancelled round would fail every remaining food in a burst and then complete. Each now stops asking once aborted and throws at the end, so the round ends Cancelled, or back to waiting on shutdown.
  - **Every failure handler uses one finality rule.** `isFinalFailure(job, error)` in `create-worker.ts` (attempts spent, or an `UnrecoverableError`) replaces the six inline `attemptsMade >= attempts` checks. Without it, a cancelled import would never have published "failed", and its skeleton would have stayed. Enrichment already had this rule inline.
  - **The job monitor.** BullMQ keeps a cancelled job as `failed`. The router maps a failed job whose reason is the administrator constant to the new `cancelled` state, with a grey chip and a translated note in the detail.
    - The Cancel job button sits on every active job and reads "Cancelling…" until the 5 s detail refetch sees the job leave `active`.
    - It has no confirmation step, matching Retry; Remove keeps its confirmation.
    - Cancelled jobs offer Retry, in case the cancel was a mistake (changed 2026-10-15; see below).
  - **Copy.** Added to all 16 locales. Most locales' job monitor is still in English, so the new keys are English there too; bg, fi and uk, whose monitor is translated, got translations.
  - **Tests.**
    - `create-worker-redis.test.ts`: admin cancel (failed, reason, `attemptsMade` 1, no retry past the backoff, the failure handler sees it as final); cancel of a job not running answers false; a shutdown cancel puts the job back with `attemptsMade` 0, and the next worker runs it. The hanging processor waits on `requestSignal`, so the ledger path is exercised end to end.
    - `structured-output.test.ts`: a held request is ended by the job's abort, and the next one is never sent.
    - `model-use-ledger.test.ts`: a nested ledger keeps the signal.
    - The review round test, and the router's `cancel` and `cancelled` mapping tests.
  - The browser E2E passed against a production build on 2026-10-14, in a 20-spec batch with the auth-gate, decision-model, calendar, clipboard-import and realtime specs. The admin docs screenshot (`admin-job-cancelled.png`) was captured from the same harness by `.scratch/architecture-after-upgrades/docs-screenshots.e2e.ts`, and the docs site builds.
- 2026-10-15, from the branch review (the maintainer's calls):
  - **Cancelled on every queue.** A queue that never calls the AI ran to the end and ended Completed. `createWorker` now fails an administrator-cancelled job as Cancelled even when its last step finished, and `reportStep` stops it before its next step. Shutdown does neither.
  - **Retry offered for a cancelled job**, in case the cancel was a mistake; a Redis test runs a retried cancelled job to completion. `isCancelled(job)` replaces the string comparison in the admin router.
