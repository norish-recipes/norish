# 54 — An idempotency claim lives five minutes until it completes

Status: resolved
Target release: 0.26.0-beta

Spec: `.scratch/dependency-upgrades/spec.md`. From `.scratch/architecture-after-upgrades/spec.md`, Further Notes ("What lands first"), fix 4.

## What to build

`runWithIdempotency` in `packages/trpc/src/idempotency-middleware.ts:128` claims an operation id with the placeholder `{ done: false }` and the full seven-day TTL. If the owning request dies before it finishes, for example in a crash or restart, the placeholder stays for seven days. Every retry of that operation, such as the Outbox replaying it, waits out the poll budget and fails for a week.

1. Claim with a five-minute TTL.
2. When the owner stores its response (`:144`), the key gets the full seven days, as today.

## Acceptance criteria

- [x] A claim whose owner never completes expires after five minutes, and a retry then runs the operation.
- [x] A completed response is still kept for seven days.
- [x] The middleware's tests cover both.

## Comments

- Filed 2026-10-14 from the architecture spec's list of fixes meant for this branch; no deps ticket tracked them.
- 2026-10-14 (implemented) — The claim is `SET ... EX 300 NX` (`IDEMPOTENCY_CLAIM_TTL_SECONDS`, a new `claimTtlSeconds` in the middleware's config); the stored response keeps `IDEMPOTENCY_TTL_SECONDS`, seven days. The test's in-memory Redis now records each key's TTL and expires keys against a clock the test moves: an owner that never finishes leaves a five-minute claim, and after five minutes a retry runs the operation; a completed response carries the seven-day TTL and is still there a second before it ends.
