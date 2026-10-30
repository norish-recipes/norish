# 51 — Workers' drainDelay is in seconds

Status: resolved
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`. From `.scratch/architecture-after-upgrades/spec.md`, Further Notes ("What lands first"), fix 1.

## What to build

`baseWorkerOptions` in `packages/queue/src/config.ts:33` sets `drainDelay: 5_000` with the comment "5 seconds". BullMQ reads `drainDelay` in seconds, so an idle worker blocks on Redis for 5,000 seconds, about 83 minutes, per wait.

1. Set it to `5` and fix the comment.

`.scratch/architecture-after-upgrades/` ticket 01 assumes this fix is already in.

## Acceptance criteria

- [x] `drainDelay` is `5`.
- [x] A real-Redis test (testcontainer, as `producer-redis.test.ts` does) shows an idle worker's blocking wait ends within seconds, not minutes.

## Comments

- Filed 2026-10-14 from the architecture spec's list of fixes meant for this branch; no deps ticket tracked them.
- 2026-10-14 (implemented) — `drainDelay: 5` with a comment that it is seconds. `packages/queue/__tests__/queue/drain-delay-redis.test.ts` starts a worker with `baseWorkerOptions` on an empty queue and watches `MONITOR` for BZPOPMIN: with `5_000` only one wait began in 10 seconds (red), with `5` the second begins about five seconds after the first (green, three runs in a row).
