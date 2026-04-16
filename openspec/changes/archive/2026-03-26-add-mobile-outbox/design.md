## Context

The mobile app is already moving toward offline-first behavior, and MMKV storage is available for persistent client-side state. The remaining reliability gap is mutation delivery: when a tRPC request fails because the backend is unreachable, the user action is lost and must be retried manually.

This change introduces a first-version outbox centered on the mobile tRPC layer. The client will capture the exact failed request payload, persist it in MMKV, and replay it later when reachability returns. The backend already favors fast acknowledgements with async follow-up work, which makes it a good fit for replay-based delivery.

Constraints:

- The solution should live at the mobile networking boundary so feature code does not need per-mutation offline logic.
- Persisted entries must survive app restarts.
- Replay must be safe to run asynchronously without blocking the UI thread.
- v1 should prefer a simple queue with predictable behavior over a fully generalized sync engine.

## Goals / Non-Goals

**Goals:**

- Persist failed mobile tRPC mutation requests in MMKV with enough information to replay the exact operation later.
- Detect when the backend becomes reachable again and trigger outbox processing automatically.
- Remove entries after a successful replay acknowledgement and retain entries after failure with incremental retry delay.
- Centralize replay orchestration, queue state, and retry bookkeeping so screens and hooks can stay unaware of offline delivery details.

**Non-Goals:**

- Guarantee exactly-once delivery across all backend handlers.
- Resolve semantic conflicts caused by duplicate or stale user actions.
- Queue read/query operations; v1 is limited to replaying write-style requests.
- Build a full sync conflict UI or user-facing outbox management surface.

## Decisions

### Capture failed mutations at the mobile tRPC transport boundary

The outbox will wrap or intercept mobile tRPC mutation execution so failures caused by backend unreachability can be serialized into a queue entry with the procedure path, input payload, request metadata, attempt count, and next eligible retry time.

This keeps offline behavior consistent across domains and avoids duplicating retry logic in individual hooks. The main alternative was adding queue logic only to selected features, but that would create uneven coverage and make future maintenance harder.

### Persist queue entries in MMKV as durable, append-only records

Each outbox item will be written to MMKV immediately after the request fails. The stored payload should remain close to the original tRPC request shape so replay can reconstruct the same call with minimal translation.

Using MMKV avoids introducing a new mobile persistence dependency and matches the existing offline-ready direction. The alternative was keeping the queue only in memory until the next reconnect, but that would lose user actions on app restart or process eviction.

### Process the outbox with a single asynchronous worker

Replay will be managed by one coordinator that checks reachability, selects eligible items, submits them, and updates storage after each result. v1 should process items serially in insertion order to reduce duplicate pressure on the backend and preserve user intent where action order matters.

Running one worker is simpler than parallel replay and makes retry bookkeeping easier to reason about. The alternative was concurrent replay for throughput, but it increases race conditions and makes queue state harder to keep consistent in MMKV.

### Treat backend acknowledgement as success and defer business completion to existing async flows

When the backend responds OK, the outbox entry is removed immediately even if downstream work continues asynchronously on the server. This aligns with the existing backend model and keeps the client queue focused on transport delivery rather than domain completion.

The alternative was keeping entries until downstream side effects were observable, but that would require new completion contracts and likely duplicate the app's existing real-time update model.

### Retry failures with incremental backoff gated by reachability

If replay fails again, the outbox item stays queued, its attempt count increases, and its next retry time is moved forward using incremental delay. Processing should pause or skip sending while the backend is still unreachable, then resume when the app detects reachability again.

This balances persistence with backend safety. A constant tight retry loop would waste battery and network resources, while requiring manual retries would undermine the offline-first goal.

## Risks / Trade-offs

- [Duplicate server-side effects if a request actually succeeded before the client observed the failure] -> Mitigation: scope v1 to backend handlers that already acknowledge quickly, and design follow-up implementation around idempotency where practical.
- [Strict serial replay can slow recovery for long queues] -> Mitigation: keep v1 simple first, then evaluate bounded concurrency after behavior is proven.
- [Reachability signals can be noisy and trigger premature retries] -> Mitigation: gate processing on both connectivity status and retry schedule, and keep failed items queued until a real OK response arrives.
- [Storing exact request payloads may capture data that becomes stale] -> Mitigation: document that v1 replays the original user intent as submitted rather than re-deriving fresh state later.

## Migration Plan

1. Add the outbox store and queue item schema in the mobile app using MMKV.
2. Integrate tRPC mutation failure interception and enqueue behavior for unreachable-backend failures.
3. Add reachability-driven replay orchestration with incremental backoff and queue cleanup on success.
4. Roll out behind existing mobile client release flow; no server migration is required for the initial version.
5. If rollback is needed, disable replay/enqueue wiring while leaving stored entries harmlessly inert until a follow-up cleanup release.

## Open Questions

- Which transport or error signatures should be treated as definitively "backend unreachable" versus domain-level failure that must not be queued?
- Do any existing mobile mutations require explicit opt-out because they are not safe to replay without stronger idempotency guarantees?
- Should v1 expose lightweight diagnostics (queue length, last replay attempt) for debugging even if there is no user-facing UI?
