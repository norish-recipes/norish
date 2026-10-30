# 17 — Scheduled tasks move to Job Schedulers while still on BullMQ 5

Status: resolved
Blocked by: 25 (type checking)
Target release: 0.26.0-beta, the commit right before ticket 18

Spec: `.scratch/dependency-upgrades/spec.md`

## What to build

Move `bullmq` from 5.81.3 to **5.81.5**, the latest 5.x, which also includes a fix to the blocking-connection watchdog. Then stop using the APIs BullMQ 6 removes. On 5.x the old and the new APIs both exist, so the migration can be done safely here.

1. **Scheduled tasks** (`packages/queue/src/scheduled-tasks/producer.ts`).
   - **Today.** `queue.add(taskType, { taskType }, { repeat: { pattern: CRON_MIDNIGHT }, jobId: taskType })`.
   - **The trap.** On v6 `repeat` is gone from both the types and the runtime. The nightly tasks would run once and never again. The tests mock `add`, so nothing would fail.
   - **Fix.** Switch to `queue.upsertJobScheduler(taskType, { pattern: CRON_MIDNIGHT }, { name: taskType, data: { taskType } })`.
   - The boot sweep already removes existing repeatables through `removeJobScheduler`, which also deletes their pending `repeat:<id>:<ms>` job.
2. **The enrichment run sequence** (`packages/queue/src/enrichment/producer.ts`).
   - **Today.** `const redis = await queue.client` followed by `redis.incr(queue.toKey("enrichment-run-sequence"))`.
   - **The trap.** `Queue.client` is removed in v6, so every enrichment enqueue would throw. The test mocks `client`.
   - **Fix.** Use `getBullClient()`, which works on both majors, then `incr(queue.toKey(...))`.
3. **The `'paused'` job type is removed in v6.** It appears in `scheduled-tasks/producer.ts` and `packages/trpc/src/routers/admin/job-queue.ts`. It only breaks at the type level: at runtime it just counts an empty list.
4. **Remove the unused `ioredis` dependencies** from `packages/api/package.json` and `packages/trpc/package.json`.
5. **Tests.** Make them assert on `upsertJobScheduler`, and on the client used for the run sequence, so the v6 bump in ticket 18 is caught by tests rather than in production.

**Improvements BullMQ 5.81 already supports**, for this PR or a follow-up:

- **Deduplication.** The `deduplication` option can replace the deterministic-id plus `getJob` preflight race in the enrichment producer.
- **Stop AI work on worker close.** Pass the processor's `signal` into the runtime's `abortSignal` (`packages/shared-server/src/ai/runtime/runtime.ts`), so a closing worker stops AI work.

## Acceptance criteria

- [x] **Fresh install.** The scheduled tasks are registered as job schedulers and fire at midnight. Verify with Redis and BullMQ's `getJobSchedulers()`.
- [ ] **Upgraded instance.** An instance upgraded from the current release ends up with no legacy repeatables, no duplicate schedulers and no stranded jobs.
- [x] **Enrichment enqueue** works and the run sequence still increments.
- [x] **Tests.** The updated tests fail against the old code paths.
- [x] **Type check.** `pnpm typecheck` passes.
- [x] **Gates and E2E.** The repo gates pass, and `pnpm test:e2e` passes (the full suite ran with ticket 18: 173 passed).

## Comments

- Filed 2026-10-12 with the spec.
- Sources:
  - the bullmq 5.81.3, 5.81.5 and 6.3.13 tarballs;
  - a search summary of BullMQ's v5 → v6 migration guide (the page itself was unreachable). That guide says to "migrate legacy repeatable jobs to Job Schedulers before upgrading".
- 2026-10-13 — No release is needed between this and ticket 18. Checked in the 5.81.3 and 6.3.14 tarballs: Norish's repeatables are md5-keyed with a `repeat:<md5>` hash; 6.3.14's `getJobSchedulers` reads them and `removeJobScheduler-3.lua` (byte-identical in both) removes them, so the boot sweep in `producer.ts:58-62` works on 6. BullMQ's guide says "migrate on v5 first", but its v6 error only fires for legacy colon-shaped keys, which Norish never wrote.
- 2026-10-13 — Done on bullmq 5.81.5 (the lockfile already held it; the catalog now says `^5.81.5`):
  - **Scheduled tasks** register with `upsertJobScheduler(taskType, { pattern: "0 0 * * *" }, { name, data: { taskType } })`; the boot sweep (`getJobSchedulers` → `removeJobScheduler`) stays in front of it.
  - **The enrichment run sequence** was already on `getBullClient()` (since 0a4f098f), and its test asserts the key and client.
  - **`paused`** is gone from the stranded-task sweep, the admin job-queue states and counts, the shared DTO, the status chip and every locale's `status.paused`.
  - **`ioredis`** is removed from packages/api and packages/trpc; neither imports it.
  - **Tests:** the producer test asserts `upsertJobScheduler` and fails against `add({ repeat })`. `producer-redis.test.ts` runs the registration twice against a real Redis and finds exactly one scheduler per task at midnight with its task as template data, and one pending run each. Per the maintainer (2026-10-13), it uses the scheduler API only, with no hand-written 5.x repeatable keys.
  - **Not done:** the upgraded-instance check from 5.x repeatables, by that decision; the sweep is what clears them. Gates: lint, typecheck, test:run, i18n:check, build, format:check and deps:cycles pass. E2E runs with ticket 18.

