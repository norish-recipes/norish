## ADDED Requirements

### Requirement: Failed mobile mutations are persisted to an outbox

The mobile client SHALL persist a failed tRPC mutation request to durable local storage when the request cannot reach the backend. The persisted outbox item MUST retain the exact procedure identifier and input payload required to replay the original request, along with retry metadata needed for later processing.

#### Scenario: Mutation fails while backend is unreachable

- **WHEN** a mobile tRPC mutation request fails because the backend cannot be reached
- **THEN** the client stores an outbox item containing the original request details and initializes retry metadata for future replay

#### Scenario: Domain failure is not queued

- **WHEN** a mobile tRPC mutation reaches the backend and returns an application-level error response
- **THEN** the client MUST NOT store that request in the outbox

---

### Requirement: Outbox items survive restarts and are replayable

The mobile client SHALL store outbox items in persistent local storage so they remain available across app restarts until replay succeeds or the item is explicitly removed. On startup, the client MUST be able to load pending items and treat them as eligible for normal outbox processing according to their retry schedule.

#### Scenario: App restarts with pending outbox items

- **WHEN** the app starts after one or more outbox items were previously stored
- **THEN** the client loads those items from persistent storage and keeps them available for future replay attempts

---

### Requirement: Reachability resumes queued request delivery

The mobile client SHALL monitor backend reachability and attempt delivery of queued outbox items once the backend becomes reachable. v1 MUST replay queued items asynchronously without requiring the original screen or user action context to still be active.

#### Scenario: Backend becomes reachable again

- **WHEN** the client detects that the backend is reachable and a queued outbox item is eligible for retry
- **THEN** the client submits the stored request to the backend asynchronously

---

### Requirement: Successful acknowledgement removes the outbox item

The mobile client SHALL remove an outbox item after the backend acknowledges the replayed request with a successful response. The client MUST treat backend acknowledgement as sufficient for removal even when downstream server-side work continues asynchronously.

#### Scenario: Replay request succeeds

- **WHEN** the backend returns a successful response for a replayed outbox item
- **THEN** the client removes that item from persistent storage and does not retry it again

---

### Requirement: Failed replay attempts are retried with incremental delay

The mobile client SHALL keep an outbox item when replay fails and MUST increment the item's attempt count and next retry delay before trying again. The client MUST NOT continuously retry the same item without waiting for its scheduled delay and a new opportunity to reach the backend.

#### Scenario: Replay fails again

- **WHEN** a queued outbox item is replayed and the request still fails to reach the backend
- **THEN** the client updates the item's retry metadata with a larger delay and leaves it in the outbox for a later attempt

#### Scenario: Item is not yet eligible for retry

- **WHEN** an outbox item's next retry time has not arrived
- **THEN** the client skips sending that item during the current processing pass

---

### Requirement: Outbox processing preserves deterministic queue behavior

The mobile client SHALL process pending outbox items through a single replay coordinator so queue state updates remain consistent. v1 MUST replay eligible items in stored order to avoid nondeterministic reordering across offline user actions.

#### Scenario: Multiple items are queued

- **WHEN** more than one outbox item is eligible for replay
- **THEN** the client submits them in the order they were stored
