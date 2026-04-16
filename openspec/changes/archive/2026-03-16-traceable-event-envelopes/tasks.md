## 1. Shared Correlation Contract

- [x] 1.1 Add shared `operationId`/operation-context types plus `RealtimeEventEnvelope` metadata types in a client-safe package export.
- [x] 1.2 Add channel metadata parsing helpers that derive namespace, scope, event name, and scope identifiers from Redis channel strings.
- [x] 1.3 Add client-safe helpers to generate, preserve, and normalize `operationId` and `{ meta, payload }` values at the tRPC edge.

## 2. Client and Request Edge Updates

- [x] 2.1 Update the shared tRPC client/provider edge so realtime-capable mutations receive an `operationId` automatically when one is not already present.
- [x] 2.2 Preserve caller-supplied `operationId` values for outbox/offline sync flows so replayed mutations keep the same identifier.
- [x] 2.3 Update tRPC request context helpers to expose the current `operationId` to downstream server code without widespread router signature changes.

## 3. Queue and Transport Edge Updates

- [x] 3.1 Update queue producer/worker boundaries so background jobs can carry and restore `operationId` during async processing.
- [x] 3.2 Update `packages/queue/src/redis/pubsub.ts` so `publish()` wraps outgoing payloads in the standard envelope before `superjson` serialization and includes the active `operationId` when present.
- [x] 3.3 Update direct Redis subscription parsing and `packages/queue/src/redis/subscription-multiplexer.ts` to preserve and forward envelope objects without stripping metadata.

## 4. tRPC Subscription Edge Compatibility

- [x] 4.1 Add envelope-aware subscription helpers in `packages/trpc/src/helpers.ts` that can expose either full envelopes or payload-only compatibility iterables.
- [x] 4.2 Keep existing router subscription procedures on the compatibility path so current subscription outputs remain stable during rollout.
- [x] 4.3 Add at least one envelope-aware subscription path or helper export that future offline work can consume without revisiting transport internals.

## 5. Client Subscription Edge Adoption

- [x] 5.1 Update shared/web/mobile subscription hook entry points to normalize incoming subscription data at the edge before domain handlers run.
- [x] 5.2 Preserve existing payload-oriented cache update logic while making envelope metadata available to callers that need reconciliation information.
- [x] 5.3 Add or adapt a minimal outbox-facing helper so clients can match `meta.operationId` against queued actions without touching every handler.

## 6. Verification

- [x] 6.1 Add unit tests for client-generated `operationId` handling, including preserving precomputed IDs for replayed offline actions.
- [x] 6.2 Add unit tests for envelope creation and channel metadata parsing across broadcast, household, user, and global channels.
- [x] 6.3 Add tests for direct Redis subscriptions and the multiplexer to confirm envelope metadata survives round-trip delivery.
- [x] 6.4 Add tests for at least one queue-backed async flow proving `operationId` propagates from mutation edge to emitted event.
- [x] 6.5 Add tests for client-edge normalizers/handlers proving existing payload consumers still work and envelope-aware consumers can access `operationId` metadata.
