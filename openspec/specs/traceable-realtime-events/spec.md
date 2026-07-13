# Traceable Realtime Events

## Purpose

Ensure every realtime subscription event carries a standard envelope with transport metadata (`operationId`, `eventId`, timestamps, channel info) so clients can correlate server-side events back to originating mutations — enabling offline reconciliation, replay deduplication, and future retrace/audit workflows.

---

## Requirements

### Requirement: Client mutations carry a stable operation ID

The system SHALL attach one client-generated `operationId` to every mutation at the client edge so online delivery, delayed replay, idempotency receipts, async work, and realtime events refer to the same logical operation.

#### Scenario: Client sends a mutation without an existing operation ID

- **WHEN** a first-party client starts a mutation without an existing `operationId`
- **THEN** the client edge SHALL generate an `operationId` before the request leaves the client
- **AND** the mutation SHALL carry that `operationId` to the backend without requiring domain-level call-site changes

#### Scenario: Offline outbox reuses a precomputed operation ID

- **WHEN** an offline action has already been stored with an `operationId`
- **THEN** every replay attempt SHALL preserve that existing `operationId`
- **AND** it SHALL NOT replace it with a new value during sync

#### Scenario: Immediate retry reuses the logical operation ID

- **WHEN** a mutation delivery is retried before or after receiving a transport failure
- **THEN** the retry SHALL carry the same operation ID as the original logical mutation

#### Scenario: Direct tRPC mutation reaches the server without an operation ID

- **WHEN** a direct tRPC mutation request lacks a valid `x-operation-id`
- **THEN** the server SHALL reject it before mutation logic executes

#### Scenario: OpenAPI mutation reaches the server without an operation ID

- **WHEN** an OpenAPI mutation request omits `x-operation-id`
- **THEN** the OpenAPI boundary SHALL generate an operation UUID before mutation logic executes

---

### Requirement: Operation IDs propagate through async processing

The system SHALL preserve `operationId` through backend request handling, queue boundaries, and emitted realtime events.

#### Scenario: Synchronous mutation emits an event

- **WHEN** a mutation with an `operationId` causes a realtime event during the original request
- **THEN** the emitted event envelope SHALL include the same `operationId`

#### Scenario: Queue-backed work emits a later event

- **WHEN** a mutation with an `operationId` schedules background work that later emits a realtime event
- **THEN** the queued job or worker context SHALL preserve that `operationId`
- **AND** the later emitted event envelope SHALL include the same `operationId`

---

### Requirement: Realtime subscription events carry a standard envelope

The system SHALL publish Redis-backed realtime subscription events in a standard envelope that preserves the existing domain payload and adds transport metadata needed for offline reconciliation and future retrace work.

#### Scenario: Publishing a household-scoped event

- **WHEN** the system publishes a household-scoped realtime event
- **THEN** the published message SHALL include a `meta` object with `version`, `eventId`, `eventName`, `namespace`, `scope`, `channel`, `occurredAt`, and the relevant scope identifier
- **AND** it SHALL include `operationId` when the event originated from a correlated client action
- **AND** the existing domain event body SHALL be preserved under `payload`

#### Scenario: Publishing a broadcast-scoped event

- **WHEN** the system publishes a broadcast realtime event
- **THEN** the envelope `meta.scope` SHALL be `broadcast`
- **AND** the envelope SHALL include the logical event name and resolved Redis channel

---

### Requirement: Direct and multiplexed subscriptions preserve envelopes

The system SHALL parse and preserve the standard envelope consistently for both direct Redis subscriptions and multiplexed WebSocket subscriptions.

#### Scenario: Direct Redis subscription receives an event

- **WHEN** a direct Redis subscription reads a published realtime event
- **THEN** it SHALL deserialize the event as the standard envelope shape
- **AND** it SHALL expose the original `payload` unchanged within that envelope

#### Scenario: Multiplexed subscription receives an event

- **WHEN** the WebSocket subscription multiplexer receives a published realtime event
- **THEN** it SHALL forward the standard envelope without stripping or rewriting metadata fields

---

### Requirement: Subscription edges provide payload compatibility with envelope access

The system SHALL let subscription consumers continue handling the existing payload shape while also making envelope metadata available at the client edge.

#### Scenario: Existing payload-oriented subscription handler runs after the change

- **WHEN** an existing subscription hook or procedure consumes a realtime event through the compatibility edge helper
- **THEN** the handler SHALL be able to read the same domain payload fields as before without domain-level rewrites

#### Scenario: Envelope-aware client persists event metadata

- **WHEN** a client chooses the envelope-aware subscription path
- **THEN** it SHALL receive both `meta` and `payload`
- **AND** `meta.eventId`, `meta.occurredAt`, and `meta.operationId` when present SHALL be stable values suitable for offline event persistence and reconciliation

#### Scenario: Offline client reconciles a queued action

- **WHEN** a client receives a realtime event whose `meta.operationId` matches a queued offline action
- **THEN** the client SHALL be able to identify that queued action as the source of the event
- **AND** the client SHALL be able to use the event type and payload to decide whether to remove or update the queued item

---

### Requirement: Envelope metadata is versioned and transport-scoped

The system SHALL treat realtime envelope metadata as a transport contract that can evolve independently from domain payload types.

#### Scenario: Future envelope evolution

- **WHEN** the system extends realtime event metadata in a later change
- **THEN** the envelope SHALL expose a `meta.version` field so clients can distinguish contract versions

#### Scenario: Domain payload remains authoritative

- **WHEN** a client receives a realtime event envelope
- **THEN** business logic SHALL continue to use the domain `payload` for application behavior
- **AND** envelope metadata SHALL NOT replace domain-specific versioning or conflict rules
