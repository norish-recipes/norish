# 08 — BullMQ 6 and ioredis 6 with no manual steps

Status: superseded
Target version: 0.26.0-beta
Blocked by: 06

Spec: `.scratch/dependency-security/spec.md`

## What to build

`bullmq` 6 and `ioredis` 6.

**Recurring jobs move to Job Schedulers.** BullMQ 6 removes `repeat:`, which `packages/queue/src/scheduled-tasks/producer.ts` uses for every recurring job. Register them with `upsertJobScheduler`, and at boot remove the legacy repeatable keys a running instance already has in Redis, so no job runs twice and none goes missing. `Queue#client`, read in `packages/queue/src/enrichment/producer.ts`, is gone: use what 6 offers instead.

**ioredis 6 stays on RESP2** (`protocol: 2`) wherever a connection is made, unless BullMQ 6 requires RESP3; the queue and realtime pub/sub code read RESP2 reply shapes and the queue tests mock Redis, so nothing else would catch the change.

## Acceptance criteria

- [ ] Test against a real Redis: an instance holding the old repeatable keys boots to exactly one scheduler per recurring job, and a second boot changes nothing.
- [ ] Realtime E2E project and import job E2E pass.
- [ ] Release notes written.
- [ ] `pnpm lint`, `pnpm test:run`, `pnpm build`, `pnpm deps:cycles`, `pnpm format:check` pass.

## Comments

- 2026-10-13 — Superseded by `.scratch/dependency-upgrades/` (decided with the maintainer the same day).
