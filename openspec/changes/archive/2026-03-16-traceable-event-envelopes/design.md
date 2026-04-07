## Context

Norish emits domain events from `packages/trpc` routers through the Redis-backed `TypedRedisEmitter` in `packages/queue`, then delivers them either through direct Redis subscriptions or the WebSocket `SubscriptionMultiplexer`. Client code in `packages/shared-react` and `apps/web` currently consumes bare domain payloads via `onData`, often typed loosely or handled as if the subscription output is the event payload itself. Mutations also do not carry a stable client-generated identifier through the backend pipeline, so queued offline work has no reliable way to recognize the server events that represent its completion.

That setup makes event delivery simple, but it erases the metadata we need for offline reconciliation: there is no stable operation ID supplied by the client, no stable event ID minted by the server, no canonical occurrence timestamp, and no explicit record of which logical event name/channel produced a payload. Because the user wants this done "at the edges," the design must keep existing domain event types intact and avoid forcing every router, hook, queue job, and cache handler to be rewritten.

## Goals / Non-Goals

**Goals:**

1. Add a client-generated `operationId` that can be attached to mutations at the client edge and propagated through backend processing.
2. Add a standard envelope around published subscription events with enough metadata to support offline reconciliation and future event retrace work.
3. Inject and unwrap operation correlation and event envelopes at transport boundaries so router event definitions and most application handlers remain unchanged.
4. Make envelope metadata available to clients that want it now, without breaking existing payload-driven subscription flows.
5. Cover direct HTTP mutations, queue-backed async work, direct Redis subscriptions, and multiplexed WebSocket delivery with the same correlation contract.

**Non-Goals:**

- Building offline storage, replay UI, or outbox workflows in this change.
- Backfilling historical event metadata for already-published Redis events.
- Reworking every event payload type to include transport metadata fields.
- Introducing domain-level business deduplication rules keyed by `operationId`.

## Decisions

### 1. Introduce shared `OperationId` and `RealtimeEventEnvelope<T>` contracts

**Decision**: Define two shared transport contracts:

1. An `OperationContext` shape that carries an optional client-generated `operationId`.
2. A `RealtimeEventEnvelope<T>` type with `meta` and `payload`. `meta` includes `version`, `eventId`, optional `operationId`, `eventName`, `namespace`, `scope` (`broadcast | household | user | global`), optional scope identifiers (`householdKey`, `userId`), `channel`, and `occurredAt` as an ISO string. `payload` remains the existing domain event payload.

**Why**: Offline reconciliation needs both identities: a client-originated `operationId` to match queued work, and a server-originated `eventId` to uniquely identify emitted events. Keeping both in transport metadata avoids contaminating domain DTOs. A version field lets us evolve the envelope later if offline retrace introduces additional metadata.

**Alternatives considered**:

- _Add metadata fields directly to every payload type_: too invasive and leaks transport concerns into domain contracts.
- _Store metadata only in logs_: helps observability, but clients still cannot reconcile or persist events.

### 2. Generate `operationId` at the client mutation edge

**Decision**: Add a thin client mutation edge helper/link that injects an `operationId` into mutation input or metadata when one is not already present. Offline/outbox code can provide its own precomputed `operationId`, while ordinary online mutations can get one automatically at the edge.

**Why**: The client is the only place that can create an identifier before work is queued offline. Generating it centrally at the mutation edge keeps the footprint low and avoids touching every mutation call site.

**Alternatives considered**:

- _Generate `operationId` on the server_: too late for offline outbox reconciliation because the client would not know the ID before enqueueing work.
- _Require every caller to generate IDs manually_: possible, but high churn and easy to miss.

### 3. Propagate `operationId` through backend request and queue edges

**Decision**: Preserve `operationId` in tRPC request context and explicit queue job metadata so routers, services, and workers can forward it to any emitted events without having to redefine domain payloads. Queue-producing code will attach the current `operationId` when enqueuing background jobs, and workers will restore that context before emitting follow-up events.

**Why**: Many Norish actions do not emit their final event in the initial HTTP request. If correlation stops at the request boundary, offline clients still cannot match later async success/failure events back to the original queued action.

**Alternatives considered**:

- _Only propagate through synchronous request handling_: insufficient for worker-driven imports, processing, and similar pipelines.
- _Embed `operationId` directly inside each BullMQ payload DTO_: workable, but more invasive than a shared job metadata edge.

### 4. Apply the envelope in Redis publish, not in individual emitters

**Decision**: Centralize envelope creation inside `TypedRedisEmitter.publish()`, with channel parsing helpers deriving `namespace`, `scope`, event name, and scope identifiers from the Redis channel string, and with the active `operationId` included when present.

**Why**: This keeps all existing `emitToHousehold`, `emitToUser`, `broadcast`, and `emitGlobal` call sites unchanged. The edge already knows both the payload and the final channel, and it can read the active operation context, so it is the narrowest place to stamp metadata consistently.

**Alternatives considered**:

- _Wrap payloads at each router/emitter call site_: high churn and easy to apply inconsistently.
- _Wrap at tRPC subscription yield time only_: misses direct Redis consumers and server-side listeners.

### 5. Parse envelopes once on subscription ingress and expose compatibility helpers on egress

**Decision**: Direct Redis subscriptions and the `SubscriptionMultiplexer` will parse messages into `RealtimeEventEnvelope<T>`. `packages/trpc` helpers will add two edge helpers: one that yields the full envelope for envelope-aware consumers, and one compatibility helper that maps envelopes back to `payload` for existing procedures.

**Why**: This keeps current subscription routers mostly intact while making the richer object available for future migrations. It also avoids repeated `superjson.parse()` and ad hoc envelope unwrapping in many call sites.

**Alternatives considered**:

- _Immediately switch every subscription procedure to envelope output_: possible, but would cascade changes through all client handlers at once.
- _Keep subscriptions returning raw payload forever_: blocks offline retrace because clients never see metadata.

### 6. Client hooks receive a small normalizer rather than broad handler rewrites

**Decision**: Add shared client-side utilities that:

1. ensure outgoing mutations carry an `operationId`, and
2. accept either a raw payload or `RealtimeEventEnvelope<T>` and return `{ meta, payload }`, where `meta` is `null` for legacy/raw paths.

Existing `onData` handlers can continue reading `payload` with minimal wrapper changes at hook edges, while outbox-aware code can inspect `meta.operationId`.

**Why**: Web and mobile have many mutation and subscription hooks. Normalizing once near the tRPC edge keeps the migration local to shared provider/hook factories and app-specific edge adapters instead of every cache mutation callback.

**Alternatives considered**:

- _Require every `onData` callback to branch on envelope shape_: repetitive and error-prone.
- _Require every mutation hook to manually attach `operationId`_: repetitive and easy to miss.
- _Hide metadata entirely from clients_: simpler short-term, but defeats the purpose of enabling future offline retrace.

### 7. Envelope metadata is append-only and non-authoritative for business ordering

**Decision**: `operationId`, `occurredAt`, and `eventId` are transport metadata for reconciliation and traceability, not a source of truth for business versioning or conflict resolution. Clients may persist them for reconciliation/retrace, but existing cache invalidation and domain reconciliation rules remain authoritative.

**Why**: Real-time delivery order across channels is not guaranteed enough to turn this contract into a domain versioning system. An `operationId` proves lineage, not authoritative final state.

## Risks / Trade-offs

- **Missing propagation across async boundaries** -> A queued action could still become untraceable if a worker path drops `operationId`; mitigate by standardizing request/job operation context helpers and testing at least one queue-backed flow.
- **Mixed raw/enveloped consumers during rollout** -> Compatibility utilities must accept both shapes until all subscription edges converge; mitigate with shared normalizers and targeted tests.
- **Channel parsing drift** -> If channel formats change, envelope metadata could be wrong; mitigate by deriving metadata from the same emitter channel helpers and covering each scope in tests.
- **Slight payload size increase** -> Every event becomes larger over Redis/WebSocket; mitigate by keeping metadata compact and avoiding duplication inside domain payloads.
- **False confidence about offline completion** -> Matching `operationId` confirms lineage, not necessarily user-visible success semantics; mitigate by continuing to rely on domain event types to determine success/failure handling.
