## Why

The web client cannot preserve mutation intent while the backend is unreachable, and the existing `operationId` is correlation metadata rather than a server-enforced idempotency contract. Proper offline mutation delivery requires one stable logical operation identity, replay-safe mutation contracts, server receipts that suppress duplicates, and a durable web outbox that converges by refetching authoritative state after reconnect.

## What Changes

- Guarantee that every tRPC mutation receives one stable `operationId` before its first delivery attempt and reuses that exact ID for every retry or delayed replay.
- Add server-side idempotency receipts for every tRPC mutation; queries remain receipt-free and are recovered through normal refetching.
- Scope receipts to the authenticated principal, procedure path, and canonical request fingerprint; replay the original successful response for exact duplicates and reject operation-ID reuse with different input.
- Encrypt stored response snapshots and avoid persisting raw request bodies so secrets such as API keys, credentials, and provider configuration are not exposed by the receipt store.
- Remove the delayed-delivery allowlist and immediate-only list. Every tRPC mutation becomes delayed-delivery-capable and must satisfy deterministic targeting, explicit-state, snapshot, version, or idempotent enqueue requirements as appropriate.
- Harden create and enqueue contracts so replay cannot create duplicate entities or duplicate background work, using stable client-generated identities or the stable `operationId` as the dedupe identity.
- Add an IndexedDB-backed web outbox that persists all mutation payload forms, including JSON and `FormData`/`Blob` inputs, and replays them in stored order with their original `operationId`.
- Scope web outbox entries to the backend origin and authenticated user. API authentication and authorization remain authoritative at replay time, while client-side scoping prevents one signed-in user from replaying another user's queued work.
- Preserve optimistic web state when a mutation is durably queued, replay when the application is running and connectivity returns, then refetch authoritative queries after the replay pass.
- Direct tRPC mutation callers must provide a stable `x-operation-id`; first-party clients provide this automatically. OpenAPI mutations receive a server-generated UUID when callers omit the optional header.
- Keep mobile outbox hardening/shared-core adoption and repository-boundary enforcement as separate follow-up deliverables. This change is web-focused and does not refactor the mobile outbox or seal raw DB imports.
- Keep offline delivery non-blocking in the web shell: connection loss may expose pending-delivery diagnostics, but it must not cover the application with a reconnect overlay.
- Make recipe creation navigation delivery-aware: a durably queued create keeps the currently loaded form/app shell alive, while an acknowledged online create may navigate to the new recipe.
- Publish the implementation as the first page in a versioned Technical documentation section for `0.20.0-beta`, with architecture, replay, and state diagrams rather than a rollout-only reference page.

## Capabilities

### New Capabilities

- `idempotent-mutation-delivery`: Stable operation identity, receipt claiming/completion/replay semantics, secure receipt persistence, universal mutation coverage, and deterministic handling of DB, file, queue, and other side effects.
- `web-mutation-outbox`: Durable user-scoped web mutation capture, JSON and binary payload persistence, ordered replay, optimistic-state preservation, reconnect processing, and authoritative refetch.

### Modified Capabilities

- `delayed-delivery-mutation-safety`: Replace explicit allowlist/immediate-only classification with universal delayed-delivery support for every tRPC mutation while retaining deterministic intent and concurrency-safety requirements.
- `traceable-realtime-events`: Broaden stable `operationId` requirements from realtime-capable mutations to every mutation and every delivery attempt.

## Impact

- Database: new receipt schema, migration, repository, secure response storage, and retention cleanup.
- Server: tRPC mutation middleware/procedure plumbing, operation-ID validation, canonical request hashing, receipt-aware response replay, queue dedupe, and mutation-contract audits.
- Shared contracts: operation-ID and delayed-delivery contracts; removal of the mutation allowlist API.
- Web: tRPC provider/link wiring, IndexedDB storage, connectivity/session integration, optimistic mutation handling, reconnect refetching, and diagnostics.
- Recipe UX: delivery callbacks prevent queued creates from triggering an offline RSC navigation and Next.js full-page fallback.
- Docs: freeze the `0.19.0-beta` documentation, start the `0.20.0-beta` delta, and document the offline system under a new Technical section.
- API clients: no operation header is required; callers may provide and resend an optional UUID when they need idempotent transport retries.
- Tests: router-wide receipt coverage, operation-ID stability, deterministic create/enqueue behavior, JSON and binary outbox persistence, cross-user isolation, ordered replay, restart recovery, and reconnect convergence.
