# 24 — Lazy workers may never report running

Status: resolved
Blocked by: 17. Checked in ticket 18's commit.
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`. This was found while researching BullMQ 6; it is not a dependency change.

## What to build

`packages/queue/src/lazy-worker-manager.ts` starts a lazy worker like this:

```ts
await worker.run();
state.isRunning = true;
log.info({ queueName }, "Lazy worker started");
```

**Suspected behaviour.** In BullMQ 5 and 6, `Worker.run()` resolves when the worker closes or pauses, not when it starts processing. The unit tests mock `run()` to resolve immediately, so they can't tell the difference. If that holds:

- `state.isRunning` stays `false` for as long as the worker runs, so the warm-idle shutdown never fires.
- A boot with jobs waiting in a lazy queue could block `startWorkers()`. `apps/web/server/index.ts` awaits that call before the server starts listening.

**This is not verified at runtime.**

**Triage:**

1. Reproduce with a real Redis (testcontainers). Start the server with a job waiting in a lazy queue and see whether it reaches `listen`. Separately, check whether `isRunning` ever becomes true.
2. If confirmed, start the worker without awaiting `run()`: keep its promise, log its rejection, and set `isRunning` from the worker's own state (`isRunning()`, or the `ready` / `active` events). Then cover it with an integration test that does not mock `run()`.

## Acceptance criteria (if confirmed)

- [x] **Integration test.** A test against real Redis shows the server starting with jobs waiting in a lazy queue, and `isRunning` true while the worker runs.
- [ ] ~~**Warm idle.** The warm-idle shutdown fires after its timeout.~~ Dropped: `.scratch/architecture-after-upgrades/` ticket 01 deletes the lazy-worker manager.

## Comments

- Filed 2026-10-12 with the spec.
- 2026-10-13 — The maintainer put the reproduction in the BullMQ 6 commit, because the same code is open then. Fix only if confirmed.
- 2026-10-13 — **Confirmed, and fixed ahead of ticket 18.** It was the offline E2E flake: `offline.e2e.ts:475` failed 1 to 2 runs in 4 with "production health endpoint did not respond within 90000ms". An earlier scenario leaves a failing URL import retrying in `recipe-import`; when the harness restarts the server, `initializeQueueEvents` finds that job waiting (or orphaned active), awaits `ensureWorkerRunning` → `createWorkerInstance` → `await worker.run()`, which settles only when the worker closes, so `startWorkers()` never returned and the server never listened. The same await also held the manager's operation lock forever and left `isRunning` false (so warm idle never fired). Fix: `run()` is started and not awaited (its rejection logged), and `isRunning` is read from `worker.isRunning()`, which BullMQ sets synchronously at the start of `run()` (5.81.5 and 6.x alike). `lazy-worker-redis.test.ts` runs it against a real Redis (testcontainers): a job waiting before registration is picked up, `createLazyWorker` returns, and the manager counts the worker as running while it works; it times out on the old code. The offline spec then passed 76 of 76 (4 repeats). Warm idle is gated on `isRunning`, which is now true while the worker runs; its 30 s timer itself was not exercised.
- 2026-10-13 (review) — Warm idle unticked: the 30 s timer was never run in a test; only its `isRunning` precondition is covered. Also: a worker whose `run()` rejects is now dropped (`destroyWorker`) so the next job starts a fresh one; before, the manager kept counting it as running (30c2b4c1).
- 2026-10-14 — Warm idle dropped rather than tested: the maintainer confirmed the lazy workers go (architecture ticket 01), warm-idle shutdown with them.
