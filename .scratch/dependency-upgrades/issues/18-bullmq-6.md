# 18 — BullMQ 6

Status: resolved
Blocked by: 17 (the commit before). Ticket 24 is checked in this commit.
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`

## What to build

Move `bullmq` to the 6.x line (6.0.0 shipped on 2026-07-30; 6.3.14 on 2026-10-13), and `ioredis` to 6.

- BullMQ 6 makes ioredis an optional peer (`>=5`) and requires it lazily, only when it is given connection options. Norish passes ioredis instances (`packages/queue/src/redis/bullmq.ts`) and depends on ioredis directly.
- **The boot sweep must stay.** A legacy md5 repeatable left in Redis would not sit idle on 6: the worker treats it as a scheduler (`worker.js:529-541`), and 6 dropped 5.x's `data` backfill, so later iterations would run with `{}` and no `taskType`. The sweep in `scheduled-tasks/producer.ts` removes them at every boot.

**ioredis 6** (decided 2026-10-13: the newest stable release, not held):

- 6.0.0 shipped on 2026-07-31; it needs Node ≥ 20. bullmq 6 accepts any `ioredis >=5`.
- **RESP3 is on by default.** Pin `protocol: 2` on every ioredis client Norish creates (BullMQ connections, realtime pub/sub, the resume streams, the Better Auth secondary storage), so the wire protocol is unchanged. Moving to RESP3 is a later, separate change.
- Read the 6.0 notes for anything beyond RESP3 that touches pub/sub, `duplicate()`, Lua scripts or reconnection, and record it in the comments.
- The ioredis dependencies that ticket 17 removes from packages/api and packages/trpc stay removed.

**Ticket 24 is checked here**, against real Redis, because `lazy-worker-manager.ts` is open anyway. Fix it only if it reproduces.

After ticket 17, the remaining breaking surface doesn't touch Norish:

- `debounce`, `discard()`, `getRepeatableJobs` and `removeRepeatable*` are removed; Norish uses none of them.
- `QueueEvents` now parses `completed.returnvalue`; Norish listens only to `waiting` and `drained`.
- `waitUntilReady()` returns `void`.
- `Worker.resume()` is async; it is already awaited in `lazy-worker-manager.ts`.
- The third constructor argument is now a backend factory.
- cron-parser moves to 5.
- The Proxy in `operation-aware-queue.ts` stays safe, because BullMQ uses no `#private` fields.

**Self-hosters:**

- **Redis.** The minimum is unchanged: 5.0.0, with 6.2.0 recommended. Compose ships `redis:8.10.1` (`docker/compose.base.yaml`), while `README.md` and the docs' `QuickStartCompose` still say 8.4.0. Both versions are fine; align the docs.
- **No downgrade.** v6 is one-way; no downgrade path is documented. → Upgrade note.

**Later improvement:** BullMQ 6's typed `ProgressType`, replacing `readStepProgress(unknown)` in `packages/queue/src/job-steps.ts`.

## Acceptance criteria

- [x] **Type check.** `pnpm typecheck` passes.
- [x] **One ioredis.** `pnpm why ioredis` shows one 6.x copy, and every client sets `protocol: 2`.
- [ ] **Boot twice.** A real-Redis test starts from a 5.x-created repeatable, boots twice on 6, and ends with exactly one scheduler per task and no legacy keys.
- [x] **Tests.** The queue tests pass, including ticket 17's scheduler and client assertions.
- [x] **Production smoke.** On a production build: a scheduled task fires, an enrichment runs, a URL import and a paste import run, and the admin job-queue view lists jobs.
- [x] **Docs.** The Redis version is aligned in `README.md` and the docs.
- [x] **Release notes.** An Upgrade note that the queue upgrade is one-way: back up Redis before upgrading if you might roll back.
- [x] **Ticket 24.** Its outcome is recorded in its comments.

## Comments

- Filed 2026-10-12 with the spec.
- 2026-10-13 — Moved into 0.26 with no release in between (see ticket 17). ioredis 6 taken with `protocol: 2`; the earlier hold reason ("BullMQ's CI still tests against ioredis 5") could not be confirmed from the registry.
- 2026-10-13 — Done: bullmq 6.3.14 and ioredis 6.0.0, one copy each in the lockfile. `protocol: 2` is set in the two option builders every client comes from: BullMQ's `getBaseOptions()` (its connections duplicate it) and shared-server's `getRedisConnectionOptions()` (publisher, subscribers via `duplicate()`, resume streams, Better Auth's secondary storage). The ioredis v5→v6 guide (wiki) lists, beyond RESP3 by default: Node ≥ 20; `replyMapping` (default `"legacy"`, unchanged shapes); RESP3 lifts subscriber-mode limits (not taken: RESP2 keeps them); `duplicate()` keeps the reply mapping; `enableOfflineQueue: false` now rejects commands sent from a `connect` listener (Norish sets it to `true`). Nothing about Lua scripts or reconnection.
  - `pnpm typecheck` passed with no change after ticket 17. `Worker.run()` still sets the running flag synchronously in 6.3.14, which ticket 24's fix relies on.
  - **Boot twice:** `producer-redis.test.ts` (ticket 17) passes on 6. Per the maintainer, it starts from Job Schedulers only, not from a hand-built 5.x repeatable.
  - **Production smoke:** not run separately. The full E2E suite covers URL and paste imports, enrichment runs and the admin job views; a scheduler firing at midnight was not watched.
  - **Docs:** README and `QuickStartCompose` now show `redis:8.10.1`, as the compose files do. **Release notes:** the one-way queue upgrade note.
  - **E2E:** 173 passed. The realtime restart flake was traced to the scenario before it and fixed in its own commit; one enrichment scenario failure is being chased as a flake (it passes alone).

- 2026-10-14 (ticket 49) — Production smoke closed. On the production image built for ticket 43 (Postgres, Redis 8.10.1, Obscura), the boot registered six Job Schedulers at `0 0 * * *`. Promoting the scheduler's next run of `groceries-cleanup` (`repeat:groceries-cleanup:1792022400000`, due at midnight) made the scheduled-tasks worker log "Processing scheduled task" and "Old groceries cleanup complete"; the job ended `completed`, and the scheduler had queued the following midnight's run (`…:1792108800000`). A URL import ran in the same session; enrichment, paste imports and the admin job views are covered by the E2E suite, as recorded above.
