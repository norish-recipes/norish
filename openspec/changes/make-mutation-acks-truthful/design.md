# Design — Truthful Mutation Acknowledgements

## Decisions

### D1. Additive flat ack shape, not a discriminated union

`MutationAck = { success: true; applied: boolean; stale?: true }` (packages/shared/src/contracts/mutation-ack.ts). Deployed mobile clients pattern-match `result.success` and `result.stale` today; a `{ status: "applied" | "stale" }` union would rename the discriminant and break them. The flat shape is a strict superset of every existing variant (`{ success: true }`, `{ success, stale? }`, `{ success, moved?, stale? }`, `{ success, stale?, preferences, version }`), all of which extend naturally by adding `applied`. It also mirrors the repository-level `MutationOutcome` (packages/db/src/repositories/mutation-outcomes.ts), so router code translates outcomes 1:1.

Exception: `recipes.create` returns a bare uuid `string`; adopting an object return is a breaking change and is deferred to a scheduled breaking-change window. It still gets converted to await its write.

Routers with `.output()` zod schemas (groceries-openapi-types.ts, planned-items-openapi-types.ts, …) must add the new fields in the same commit as the conversion — tRPC strips fields absent from output schemas.

### D2. Errors are thrown, `failed` events retired for converted mutations

The `failed` realtime event existed because the response had already lied (`success: true` returned before the write). Once the handler awaits its write, errors surface as `TRPCError`s through the RPC error path, which client hooks already handle (`onError` → invalidate + toast). Emitting both would double-report. The `failed` event remains only for genuinely asynchronous workflows (queue jobs, CalDAV sync, archive import). The `stale` event keeps firing alongside `stale: true` in responses until deployed clients that only understand the event age out.

### D3. Emits are awaited in converted mutations

`pubsub.publish` catches its own errors (packages/shared-server/src/redis/pubsub.ts), so awaiting an emit cannot throw; it costs one Redis publish and buys deterministic event-before-response ordering plus the removal of every `flushAsync()` test hack.

### D4. Households ordering

Awaited before return: the DB write and permission/household cache invalidation (the client refetches immediately after the mutation resolves; a stale cache would flicker the UI back). Not awaited: realtime connection termination — over the WebSocket link it would sever the transport carrying the response. Termination stays an explicit deferred step with a justification comment and a scoped lint disable, classified in the audit matrix.

### D5. `archive.importArchive` stays in-process with an enqueue contract

Its own immediate work (upload parsing + validation) is already awaited; only the import runs in the background with progress events. Moving it to BullMQ requires persisting multi-MB upload buffers outside Redis job data — a storage design of its own, filed as follow-up. The mutation is classified `enqueue`.

### D6. Enforcement is a walking test plus a scoped lint rule

`packages/trpc/__tests__/delayed-delivery-allowlist-accuracy.test.ts` walks `appRouter._def.procedures` and asserts: every allowlist entry exists and is a mutation; eligible entries carry their declared version contract (top-level `version`, snapshot `{id, version}[]`, dual recurring versions, or a justified opaque exception); no entry is in both lists; every mutation has an ack classification; and the fire-and-forget set matches an explicit list that may only shrink. New unclassified mutations fail CI. Once conversions start, `@typescript-eslint/no-floating-promises: "error"` scoped to `packages/trpc/src/routers/**` prevents regressions between test runs.

## Conversion recipe (per mutation)

1. Make the handler `async`; await auth/lookup helpers; throw `TRPCError` for validation/not-found.
2. Await the authoritative write; repositories return `MutationOutcome`.
3. Stale: emit `stale` event (compat) and return `staleAck(...)`.
4. Applied: await the domain event emit, return `appliedAck(...)`.
5. Update the `.output()` schema and tests in the same commit; delete `flushAsync` waits.

Conversion order (risk-ascending): `ratings.rate` → `stores.delete` → groceries quartet (`update`, `reorderInStore`, `markAllDone`, `deleteDone`) → recurring (`updateRecurring`, `detachRecurring`, `deleteRecurring`, `checkRecurring`) → recipes (`create`, `update`, `delete`, `convertMeasurements`) → households last (D4).

## Out of scope

- Idempotency receipts keyed by operationId (separate change: `add-idempotency-receipts`, sequenced after this one; supersedes the "no receipt table" non-goal of 2026-03-21-make-offline-mutations-predictable for lost-response replay and create-style mutations only).
- operationId echo suppression in subscription hooks.
- The web outbox itself and allowlist consumption at enqueue time.
- Archive import migration to BullMQ.
