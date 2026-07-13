## ADDED Requirements

### Requirement: Closed-PWA replay is capability-gated

The web client SHALL feature-detect service-worker Background Sync and SHALL register a deduplicated Norish outbox sync task when a mutation is durably queued and the capability is available.

#### Scenario: Background Sync is available

- **WHEN** a mutation is persisted to the web outbox
- **AND** the active service-worker registration exposes Background Sync
- **THEN** the client SHALL register the Norish outbox sync tag

#### Scenario: Background Sync is unavailable

- **WHEN** a mutation is persisted to the web outbox
- **AND** Background Sync is unavailable or registration fails
- **THEN** the mutation SHALL remain durable
- **AND** active-app replay and next-launch replay SHALL remain enabled

### Requirement: Service-worker replay uses the existing outbox contract

The service worker SHALL replay existing outbox entries without creating a second queue, preserving operation ID, procedure path, encoded input, origin scope, user scope, FIFO order, retry metadata, and receipt-compatible delivery headers.

#### Scenario: PWA is completely closed and connectivity returns

- **WHEN** the browser dispatches the Norish outbox sync event while no app window is open
- **THEN** the service worker SHALL process eligible outbox entries asynchronously
- **AND** a successful receipt-backed delivery SHALL mark the original entry completed

#### Scenario: Replay is interrupted

- **WHEN** the service worker stops during a replay pass
- **THEN** the entry SHALL remain recoverable from durable state
- **AND** a later sync or app launch SHALL be able to resume it without generating a new operation ID

### Requirement: Closed-PWA replay verifies current authentication scope

Before delivering an entry, the service worker SHALL verify that the current cookie-authenticated server session belongs to the stored user ID and backend origin.

#### Scenario: Session matches the queued user

- **WHEN** current session validation returns the stored user ID
- **THEN** the service worker MAY deliver the entry

#### Scenario: Session is missing, expired, or belongs to another user

- **WHEN** session validation fails or returns a different user ID
- **THEN** the service worker SHALL not deliver the entry
- **AND** SHALL quarantine it with an actionable authentication or scope status

### Requirement: Foreground and service-worker replay cannot concurrently own the same head entry

The web outbox SHALL use a durable lease or equivalent cross-context coordination so that a foreground tab, another tab, and the service worker cannot concurrently process the same head entry.

#### Scenario: Foreground replay is active during a sync event

- **WHEN** a service-worker sync event starts while a foreground coordinator owns the queue lease
- **THEN** the service worker SHALL defer without sending a duplicate request

#### Scenario: Service-worker lease expires

- **WHEN** a service-worker replay terminates before completing an entry and its lease expires
- **THEN** a later coordinator SHALL be able to reclaim the entry according to retry and receipt rules

### Requirement: Closed-PWA replay preserves FIFO and terminal handling

The service worker SHALL process entries in stored order, stop when the head requires backoff or authentication, and apply the existing retry, conflict, stale-version, terminal, and receipt-result handling semantics.

#### Scenario: Head entry is retryable

- **WHEN** the head entry cannot reach the backend
- **THEN** the service worker SHALL update retry metadata and SHALL NOT overtake the head with later entries

#### Scenario: Head entry succeeds

- **WHEN** the head entry receives a successful or exact duplicate receipt response
- **THEN** the service worker SHALL mark it completed and MAY continue with the next entry

#### Scenario: Head entry is terminal

- **WHEN** the server rejects the entry with a conflict, stale version, authorization, or terminal domain error
- **THEN** the service worker SHALL persist the terminal or quarantined state and SHALL stop before later entries overtake it

### Requirement: Closed-PWA outcomes are observable after reopening

The service worker SHALL persist all replay outcomes durably and SHALL notify controlled clients when possible, while the next app launch SHALL read durable state when no client was available.

#### Scenario: Page is open when replay completes

- **WHEN** the service worker completes, retries, quarantines, or terminates an entry
- **THEN** it SHALL notify controlled clients to refresh queue diagnostics and relevant query state

#### Scenario: No page is open during replay

- **WHEN** the service worker changes an entry while the PWA is completely closed
- **THEN** the next app launch SHALL expose the persisted outcome through the queue view

