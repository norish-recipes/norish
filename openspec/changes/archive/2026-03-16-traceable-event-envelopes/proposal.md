## Why

Norish's real-time subscriptions currently ship bare domain payloads from Redis through tRPC WebSocket subscriptions, and mutations do not carry a stable client-generated operation identifier through the backend pipeline. That means an offline client can queue work, reconnect, and receive follow-up events, but it still cannot reliably match those events back to the queued action it is trying to clear. Adding operation correlation plus a standard event envelope now lets us support offline reconciliation without rewriting every router, emitter, and subscription consumer later.

## What Changes

- Add a standard, versioned envelope metadata block to Redis-backed tRPC subscription events so each event carries a server-generated `eventId`, timestamp, routing context, event name, and optional client-correlated `operationId`.
- Add a client mutation edge that generates an `operationId` when one is not already present and sends it to the backend with minimal mutation-call-site changes.
- Propagate `operationId` through backend request, queue, worker, and event emission edges so asynchronous follow-up events can be matched back to the originating client operation.
- Preserve existing domain payload access for current consumers by exposing envelope metadata alongside the current payload shape instead of forcing broad feature-level rewrites.
- Add shared typing and tests for operation correlation, direct Redis subscriptions, multiplexed subscriptions, and client subscription handling.

## Capabilities

### New Capabilities

- `traceable-realtime-events`: Standardize operation correlation and metadata envelopes for Redis/tRPC realtime events so offline clients can reconcile queued actions against later server events.

### Modified Capabilities

## Impact

- **`packages/shared-react`** - tRPC client mutation edges will generate or reuse `operationId` values and expose envelope-aware subscription helpers.
- **`packages/trpc`** - Request context and subscription helpers will preserve operation correlation through to WebSocket outputs.
- **`packages/queue`** - Queue producer/worker boundaries and Redis pub/sub edges will carry `operationId` and create envelope metadata.
- **`packages/shared` / `packages/shared-server`** - Shared event envelope, operation context, and normalization utilities will be introduced.
- **`apps/web` and `apps/mobile`** - Mutation and subscription entry points may adopt the new helpers, while most domain handlers should require minimal or no logic changes.
- **Testing** - Add coverage for client-generated operation IDs, async propagation, envelope serialization, multiplexed delivery, and client compatibility.
