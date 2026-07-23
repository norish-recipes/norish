# Replay idempotency via a generic operation-id middleware

Outbox Replay can deliver a mutation twice (connection lost between server commit and client ack), so duplicate-safety is mandatory, not optional. We make every mutation idempotent with one generic tRPC middleware: mutations carrying `x-operation-id` atomically claim that id in Redis (TTL-bounded) and store their serialized response; a repeat with the same id returns the stored response without re-executing. Redis is already a hard dependency (realtime pub/sub), and the mobile outbox — which already resends its `operationId` — becomes duplicate-safe with zero client changes.

## Considered options

- Accept rare duplicates (client-only): rejected — flaky connectivity is the primary scenario, so mid-replay interruption is the common case, not the edge case.
- Per-router receipt/fingerprint machinery (the `feat/make-web-offline-safe` approach, ~1,200 lines): rejected — same idea, unmanageable blast radius; the middleware must stay path-agnostic to match the no-whitelist Outbox.

## Consequences

- Mutation responses must remain serializable (superjson) — true today for all routers, including file-upload procedures whose outputs are plain DTOs.
- Idempotency is scoped to the Redis TTL window; an Outbox entry replayed after the TTL could still duplicate. TTL must comfortably exceed realistic offline periods for the supported scenarios.
