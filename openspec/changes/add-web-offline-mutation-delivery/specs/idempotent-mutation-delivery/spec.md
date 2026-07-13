## ADDED Requirements

### Requirement: Every mutation carries one stable operation identity

The system SHALL assign exactly one `operationId` to every tRPC mutation before its first delivery attempt and SHALL preserve that value through retries, delayed replay, queue boundaries, and response replay. Direct tRPC mutation requests without a valid `x-operation-id` SHALL be rejected before mutation logic executes. OpenAPI mutation requests that omit the optional header SHALL receive a server-generated UUID.

#### Scenario: First-party client starts a mutation

- **WHEN** a web or mobile client starts a mutation without an existing operation identity
- **THEN** the client SHALL generate one `operationId` before the request leaves the client
- **AND** every delivery attempt for that logical mutation SHALL use the same value

#### Scenario: Direct tRPC caller omits the operation identity

- **WHEN** a direct tRPC mutation request does not provide a valid `x-operation-id`
- **THEN** the server SHALL reject the request before invoking the mutation handler

#### Scenario: OpenAPI caller omits the operation identity

- **WHEN** an OpenAPI mutation request does not provide an `x-operation-id`
- **THEN** the server SHALL generate a UUID for that request before invoking the mutation handler
- **AND** a caller MAY provide and reuse a UUID when idempotent retries are required

### Requirement: Every mutation is receipt-backed

The system SHALL apply idempotency receipt handling to every tRPC mutation procedure. Query and subscription procedures SHALL remain receipt-free.

#### Scenario: New mutation is added to the app router

- **WHEN** a new tRPC mutation procedure is added
- **THEN** the router-wide coverage test SHALL require that procedure to run through receipt handling
- **AND** the procedure SHALL NOT require addition to a delayed-delivery allowlist

#### Scenario: Query is retried

- **WHEN** a query is retried or refetched
- **THEN** the system SHALL execute the read normally without creating an idempotency receipt

### Requirement: Receipt identity is scoped to the authenticated principal

The system SHALL key receipts by authenticated user identity and `operationId`, regardless of whether the user authenticated by session cookie or API key. Authentication SHALL complete before receipt lookup or mutation execution.

#### Scenario: Same operation ID is used by different users

- **WHEN** two authenticated users submit the same `operationId`
- **THEN** the system SHALL treat them as separate principal-scoped operations

#### Scenario: Unauthenticated replay is attempted

- **WHEN** a queued mutation is replayed without a valid authenticated principal
- **THEN** the server SHALL reject it before reading or creating a receipt

### Requirement: Exact duplicate returns the original response

The system SHALL store enough protected response information to reproduce the successful tRPC response for a completed mutation. A duplicate with the same principal, `operationId`, procedure path, and canonical request fingerprint SHALL return that response without invoking the handler again.

#### Scenario: Response is lost after commit

- **WHEN** a mutation completes and its response is lost before the client receives it
- **AND** the client retries with the same principal, operation ID, path, and input
- **THEN** the server SHALL return the original response
- **AND** it SHALL NOT repeat the mutation's logical effects

#### Scenario: Create response is replayed

- **WHEN** a completed create mutation is retried with the same operation identity and input
- **THEN** the response SHALL contain the same entity identifiers and result values as the first execution

### Requirement: Operation ID reuse with different intent is rejected

The system SHALL bind a receipt to its procedure path and canonical request fingerprint. Reuse of the same principal-scoped `operationId` with a different path or input SHALL return a conflict without invoking either mutation handler.

#### Scenario: Operation ID is reused for another path

- **WHEN** a completed or processing operation ID is submitted for a different mutation path
- **THEN** the server SHALL return `CONFLICT`
- **AND** no mutation handler SHALL execute

#### Scenario: Operation ID is reused with changed input

- **WHEN** a mutation retry changes any canonical input value while reusing the operation ID
- **THEN** the server SHALL return `CONFLICT`
- **AND** the original receipt SHALL remain unchanged

### Requirement: Concurrent duplicate execution is suppressed

The system SHALL claim a new operation atomically and SHALL permit at most one active handler execution for the same principal-scoped operation ID. A matching duplicate received while the first execution holds a valid processing lease SHALL receive a retryable in-progress result.

#### Scenario: Two identical requests arrive concurrently

- **WHEN** two matching mutation requests with the same principal and operation ID arrive concurrently
- **THEN** only one request SHALL invoke the handler
- **AND** the other request SHALL receive a retryable in-progress result or the completed stored response

### Requirement: Receipt persistence protects sensitive data

The receipt store SHALL persist a canonical request hash instead of the raw request body and SHALL encrypt stored response payloads using the server encryption boundary. Receipt logs SHALL NOT contain raw mutation inputs, credentials, tokens, API keys, or decrypted responses.

#### Scenario: API key creation response is stored

- **WHEN** an API-key creation mutation completes
- **THEN** its one-time key response SHALL be encrypted before receipt persistence
- **AND** an exact authorized duplicate SHALL be able to recover the same response

#### Scenario: Credential-bearing mutation is fingerprinted

- **WHEN** a mutation input contains passwords, provider secrets, tokens, files, or binary data
- **THEN** the receipt SHALL store only the canonical fingerprint and non-sensitive routing metadata

### Requirement: Mutation effects remain deterministic across receipt recovery

Every mutation SHALL satisfy a deterministic replay contract in addition to receipt handling. PostgreSQL-only mutations SHALL commit their authoritative write and receipt completion atomically. Non-PostgreSQL effects SHALL use stable operation or entity identity so execution after an expired processing lease cannot duplicate the logical effect.

#### Scenario: PostgreSQL mutation commits

- **WHEN** a mutation's authoritative effects are contained in PostgreSQL
- **THEN** the domain write and completed receipt SHALL commit in one transaction
- **AND** neither SHALL remain committed without the other

#### Scenario: Mutation enqueues background work

- **WHEN** a mutation accepts BullMQ work
- **THEN** the downstream job SHALL use a deterministic identity derived from the operation ID
- **AND** replay SHALL return the existing acceptance result rather than enqueue another logical job

#### Scenario: Mutation creates an entity

- **WHEN** a delayed create mutation is executed or recovered
- **THEN** it SHALL use a stable client-generated entity ID or equivalent deterministic key
- **AND** retry SHALL resolve to the original entity rather than creating another one

#### Scenario: Mutation changes a file

- **WHEN** a delayed mutation writes, replaces, or deletes media
- **THEN** the file target SHALL be deterministic for the original operation or entity
- **AND** retry SHALL preserve the intended final file state

### Requirement: Receipts and queued operations share a retention contract

The system SHALL retain completed receipts for at least the maximum supported client outbox age. Processing receipts SHALL use bounded leases and SHALL NOT be removed by normal completed-receipt cleanup while active.

#### Scenario: Delayed request retries within the supported window

- **WHEN** a queued mutation is replayed before its maximum outbox age expires
- **THEN** any completed receipt for that operation SHALL still be available for response replay

#### Scenario: Completed receipt expires

- **WHEN** a completed receipt is older than the configured retention window
- **THEN** cleanup MAY delete it
- **AND** clients SHALL NOT retain pending outbox entries beyond that same window
