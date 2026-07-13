## MODIFIED Requirements

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
