## Purpose

Define durable, encrypted, origin- and user-scoped web mutation queuing and replay behavior.

## Requirements

### Requirement: Every web mutation can be durably queued

The web client SHALL durably capture any tRPC mutation that cannot reach the backend. It SHALL NOT use a mutation-path allowlist or immediate-only list. Query and subscription operations SHALL NOT be written to the mutation outbox.

#### Scenario: Any mutation fails because the backend is unreachable

- **WHEN** a web tRPC mutation cannot reach the backend
- **THEN** the client SHALL persist that mutation before reporting queued delivery
- **AND** eligibility SHALL NOT depend on its procedure path

#### Scenario: Query fails while offline

- **WHEN** a query cannot reach the backend
- **THEN** the client SHALL NOT create an outbox entry
- **AND** normal reconnect refetching SHALL recover the read

### Requirement: The web outbox preserves complete replay input

Each web outbox entry SHALL preserve schema version, backend origin, authenticated user ID, stable operation ID, tRPC procedure path, encoded input, payload kind, creation time, attempt count, next retry time, and delivery state.

#### Scenario: JSON mutation is queued

- **WHEN** a SuperJSON-compatible mutation is queued
- **THEN** its input SHALL be serialized losslessly with the shared transformer
- **AND** replay SHALL reconstruct the original values and types

#### Scenario: FormData mutation is queued

- **WHEN** a mutation contains `FormData`, `File`, or `Blob` values
- **THEN** IndexedDB SHALL preserve ordered form entries, string fields, binary bytes, file name, MIME type, and last-modified metadata
- **AND** replay SHALL reconstruct an equivalent `FormData` request

### Requirement: Persisted web mutation data is protected

The web outbox SHALL store encoded inputs and deferred responses in IndexedDB encrypted with a non-extractable origin-owned Web Crypto key. It SHALL NOT log raw payloads, credentials, file bytes, tokens, API keys, or decrypted responses.

#### Scenario: Sensitive mutation is queued

- **WHEN** a mutation contains credentials, provider secrets, tokens, or private files
- **THEN** the stored payload SHALL be encrypted before the enqueue operation is acknowledged

#### Scenario: Storage encryption fails

- **WHEN** the client cannot encrypt and durably persist a mutation
- **THEN** it SHALL NOT report that mutation as queued
- **AND** it SHALL surface a local delivery error

### Requirement: Web outbox entries are scoped to origin and user

The web replay processor SHALL select only entries whose backend origin and stored user ID match the active backend and authenticated user. Normal API authentication and authorization SHALL still execute for every replay request.

#### Scenario: Another user signs in

- **WHEN** queued entries belong to a different user than the active session
- **THEN** the processor SHALL NOT replay those entries
- **AND** it SHALL keep them quarantined for their original user or explicit discard

#### Scenario: Backend origin changes

- **WHEN** an outbox contains entries for another backend origin
- **THEN** the processor SHALL NOT send those entries to the active origin

### Requirement: Replay preserves the original operation ID

The web outbox SHALL store the operation ID assigned before the first request and SHALL supply it through tRPC operation context and `x-operation-id` on every replay attempt. Replay requests SHALL be marked so an unreachable replay is not captured as a second outbox item.

#### Scenario: Failed first attempt is replayed

- **WHEN** a persisted mutation is retried after reconnect
- **THEN** the replay SHALL use the exact operation ID from the original attempt
- **AND** the operation-ID link SHALL NOT generate a replacement

#### Scenario: Replay is unreachable again

- **WHEN** a replay attempt cannot reach the backend
- **THEN** the existing entry SHALL update its retry metadata
- **AND** no duplicate entry SHALL be appended

### Requirement: Replay preserves strict stored order

The web outbox SHALL use one replay coordinator and SHALL process pending entries serially in stored creation order. A retryable or not-yet-eligible head entry SHALL block later entries until it succeeds, reaches a terminal result, expires, or is explicitly discarded.

#### Scenario: Earlier operation is in backoff

- **WHEN** the first pending entry is not yet eligible for retry
- **THEN** the coordinator SHALL schedule that retry
- **AND** it SHALL NOT replay later entries during the current pass

#### Scenario: Create is followed by update

- **WHEN** an offline create and a dependent update are queued in that order
- **THEN** the create SHALL receive a terminal server result before the update is sent

### Requirement: Queued mutations preserve optimistic web behavior

After a mutation is durably queued, the web client SHALL expose a typed queued-delivery condition distinct from an ordinary domain failure. Mutation hooks SHALL preserve their optimistic state, avoid normal rollback/error behavior, and provide a visible pending-delivery indication.

#### Scenario: Optimistic mutation becomes queued

- **WHEN** an optimistic mutation cannot reach the backend but is durably persisted
- **THEN** the optimistic cache update SHALL remain visible
- **AND** the client SHALL indicate that the change is waiting for delivery

#### Scenario: Durable enqueue fails

- **WHEN** the outbox cannot persist the operation
- **THEN** the mutation SHALL follow its ordinary error reconciliation path
- **AND** the UI SHALL NOT claim that delivery is pending

#### Scenario: Recipe create is durably queued

- **WHEN** a user submits the create-recipe form while the backend is unreachable
- **AND** `recipes.create` is durably persisted in the web outbox
- **THEN** the optimistic recipe SHALL remain cached
- **AND** the currently loaded create form/app shell SHALL remain mounted
- **AND** the client SHALL NOT start a Next.js route navigation until the create receives an online acknowledgement

#### Scenario: Recipe create is acknowledged online

- **WHEN** `recipes.create` receives a successful server response
- **THEN** the client MAY navigate to the reserved recipe ID

#### Scenario: Queued recipe mutation does not trigger route loading

- **WHEN** a recipe import, update, or delete mutation is durably queued because the backend is unreachable
- **THEN** its optimistic state SHALL remain available on the currently loaded screen
- **AND** the client SHALL NOT start its mutation-driven Next.js route navigation
- **AND** the corresponding navigation SHALL run after an online acknowledgement

### Requirement: Replay outcomes are classified and retained when necessary

The replay processor SHALL distinguish retryable transport failures, receipt in-progress responses, successful or duplicate acknowledgements, stale/conflict outcomes, authentication failures, and other terminal domain errors. Responses containing non-reconstructable one-time data SHALL remain encrypted and associated with the original user until explicitly consumed.

#### Scenario: Server acknowledges a replay

- **WHEN** replay returns a successful first-execution or duplicate-receipt response
- **THEN** the entry SHALL leave the pending queue
- **AND** its result SHALL be reconciled or retained for user consumption as required

#### Scenario: Replay returns one-time data

- **WHEN** a replayed mutation returns a secret or result that cannot be reconstructed by refetch
- **THEN** the completed entry SHALL retain that encrypted response
- **AND** the same authenticated user SHALL be able to consume it before deletion

#### Scenario: Replay returns a terminal domain error

- **WHEN** the server receives the operation and returns a non-retryable domain error
- **THEN** the entry SHALL stop retrying
- **AND** the client SHALL surface the terminal result and reconcile authoritative state

#### Scenario: Authentication expires during replay

- **WHEN** replay returns an authentication failure
- **THEN** processing SHALL pause
- **AND** the item SHALL NOT be replayed under a later different user

### Requirement: Reconnect replay converges through refetch

The web client SHALL start an outbox processing pass when the application is running and backend connectivity returns, and SHALL refetch authoritative active queries after that pass whether the queue drains or stops with remaining work.

#### Scenario: Browser reconnects with queued mutations

- **WHEN** backend connectivity changes from unreachable to reachable
- **THEN** the client SHALL start one replay pass
- **AND** it SHALL refetch active queries when the pass settles

#### Scenario: Application restarts with queued mutations

- **WHEN** the web application starts with matching user/origin entries in IndexedDB
- **THEN** the entries SHALL remain available
- **AND** replay SHALL resume once authentication and connectivity are ready

### Requirement: Web outbox retention matches receipt retention

Pending entries SHALL expire no later than the configured server receipt-retention window. Expired entries SHALL not be sent and SHALL produce a user-visible expiration result before removal or explicit acknowledgment.

#### Scenario: Pending entry exceeds maximum age

- **WHEN** a queued mutation becomes older than the supported outbox window
- **THEN** the client SHALL mark it expired without replaying it
- **AND** it SHALL refetch authoritative state

### Requirement: Connection loss does not block the web application

The web client SHALL keep the application interactive while HTTP or WebSocket connectivity is unavailable. Connection state MAY trigger replay, refetch, and pending-delivery diagnostics, but SHALL NOT mount a full-screen reconnect overlay.

#### Scenario: WebSocket reconnects while the application is usable

- **WHEN** the lazy WebSocket is connecting or temporarily disconnected
- **THEN** the current application screen SHALL remain interactive
- **AND** queued mutation status SHALL be communicated through the outbox diagnostics surface instead of a blocking overlay
