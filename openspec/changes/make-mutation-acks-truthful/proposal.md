## Why

Roughly a quarter of Norish's tRPC mutations acknowledge success before their authoritative DB write has happened: the handler starts a `helper().then(write + emit).catch(log + emit "failed")` chain without awaiting it and returns `{ success: true }` immediately. The server therefore acknowledges writes it has not performed and may never perform, retracting them afterwards through a side-channel `failed` realtime event. That makes mutation responses untrustworthy inputs for the planned web outbox, forces `flushAsync()` timing hacks in tests, and hides silent write failures behind a success response.

## What Changes

- Classify every mutation in `appRouter` as `awaited`, `fire-and-forget`, or `enqueue` in an audit matrix, enforced by a walking test so no mutation can ship unclassified and the fire-and-forget set can only shrink.
- Fix the delayed-delivery allowlist entries that reference non-existent procedure paths (`recurringGroceries.*` → `groceries.*`) and enforce allowlist accuracy (existence, mutation type, version contracts) mechanically in CI.
- Define a standard additive write-acknowledgement contract (`MutationAck`: `{ success: true, applied: boolean, stale?: true }`) mirroring the repository-level `MutationOutcome`, with errors thrown as `TRPCError`s instead of returned in-band.
- Convert fire-and-forget mutations to await their authoritative write and emit decision before returning, without changing optimistic UI behavior in shared/web/mobile hooks.
- Stop emitting the `failed` realtime event from converted mutations (errors now surface through the RPC error path); keep it only for genuinely asynchronous workflows. Keep the `stale` event during the transition for deployed clients.
- Add a scoped `@typescript-eslint/no-floating-promises` guardrail for `packages/trpc/src/routers/**` once conversion starts, with justified inline disables only for matrix-classified intentional cases (e.g. connection termination after household membership changes, `restartServer`).
- Long-running workflows (recipe imports, AI jobs, CalDAV sync, archive import, `restartServer`) keep or formalize enqueue-style contracts; they only acknowledge acceptance, never completion.

## Capabilities

### New Capabilities

- `mutation-acknowledgement`: Standard truthful acknowledgement semantics for write mutations — applied/stale response contract, thrown errors, enqueue-contract exceptions, and the audit classification that enforces them.

### Modified Capabilities

- `delayed-delivery-mutation-safety`: Allowlist entries must reference real `appRouter` procedure paths and their version contracts are verified mechanically; the allowlist gains an accuracy test as its first production-adjacent consumer.

## Impact

- `packages/shared` contracts: new `mutation-ack.ts`; corrected `delayed-delivery-allowlist.ts`
- `packages/trpc` routers: groceries, recurring groceries, recipes, households, stores, ratings, caldav conversions; `.output()` schemas updated alongside (tRPC strips undeclared fields)
- `packages/trpc/__tests__`: allowlist-accuracy walking test, characterization then conversion tests, removal of `flushAsync` hacks
- `packages/shared-react` hooks: unchanged optimistic behavior; add `stale`-flag reconciliation where missing
- `tooling/eslint` / `packages/trpc` eslint config: scoped no-floating-promises guardrail
