## Purpose

Define the safety contract required before a mutation can be delivered later from offline clients without changing the user-intended outcome.

## Requirements

### Requirement: Delayed-delivery eligibility is explicit

The system SHALL treat every tRPC mutation as delayed-delivery-compatible without consulting a mutation-path allowlist or immediate-only list. Every mutation SHALL satisfy the deterministic safety contract appropriate to its inputs and side effects before universal delayed delivery is enabled.

#### Scenario: Existing mutation is audited for universal delivery

- **WHEN** the universal delayed-delivery change is enabled
- **THEN** every existing app-router mutation SHALL be covered by stable operation identity and receipt handling
- **AND** every mutation SHALL satisfy explicit-state, version, snapshot, deterministic-create, deterministic-file, or idempotent-enqueue requirements as applicable

#### Scenario: New mutation is added

- **WHEN** a new app-router mutation is introduced
- **THEN** it SHALL inherit delayed-delivery support automatically
- **AND** router-wide tests SHALL fail unless its deterministic effect contract and receipt coverage are valid

#### Scenario: Legacy allowlist is removed

- **WHEN** universal delayed delivery is implemented
- **THEN** the delayed-delivery eligible and immediate-only arrays, lookup helpers, and allowlist-specific tests SHALL be removed

---

### Requirement: Delayed binary actions encode the requested final state

Any delayed-delivery-compatible mutation that changes a binary or enum-like state SHALL carry the caller's desired final state in the request and SHALL persist that state instead of deriving a new state from the server's current value.

#### Scenario: Delayed favorite action arrives after the current state changed

- **WHEN** a delayed favorite-style mutation is delivered after the recipe's current favorite state no longer matches what the user saw originally
- **THEN** the request SHALL still express the caller's intended final state rather than an instruction to toggle the current server value

#### Scenario: Existing explicit-state mutation stays deterministic

- **WHEN** a delayed mutation already includes an explicit state such as `isDone: true`
- **THEN** the server SHALL use that explicit value as the only requested state transition

---

### Requirement: Delayed destructive bulk mutations use the original row snapshot

Any delayed-delivery-compatible bulk delete, bulk mark, or container-scoped destructive mutation SHALL carry the original targeted row snapshot as `id` + `version` pairs, and the server SHALL limit its work to that snapshot.

#### Scenario: Late delete-done preserves newly added rows

- **WHEN** a delayed delete-done request is delivered after new done groceries were added to the same store
- **THEN** the system SHALL delete only the groceries present in the original request snapshot
- **AND** it SHALL leave later-added groceries unchanged

#### Scenario: Late store deletion preserves later grocery additions

- **WHEN** a delayed store deletion request includes the store version and a snapshot of the groceries that were in the store when the user triggered the action
- **THEN** the system SHALL only delete or unassign the snapshotted groceries
- **AND** it SHALL delete the store only if the store is empty after processing that snapshot

---

### Requirement: Delayed versioned writes do not overwrite newer state

Any delayed-delivery-compatible mutation that targets an existing mutable entity SHALL compare the supplied version against the authoritative stored version before mutating that entity, and SHALL NOT overwrite newer state when the versions no longer match.

#### Scenario: Stale delayed update targets a changed row

- **WHEN** a delayed update or delete request arrives with a version that no longer matches the stored row version
- **THEN** the system SHALL leave that row unchanged
- **AND** the system SHALL log that stale delayed request as a no-op

#### Scenario: Matching delayed update applies once

- **WHEN** a delayed update or delete request arrives with an `id` and version that still match the authoritative row
- **THEN** the system SHALL apply the requested mutation to that row

---

### Requirement: Delayed create and membership mutations use deterministic targeting

Any delayed mutation that creates a new entity or resolves a target by lookup SHALL carry a deterministic identity or immutable target that still refers to the same intended result when delivered later. A mutable lookup value alone SHALL NOT be sufficient when it can resolve to a different target at replay time.

#### Scenario: Delayed create provides a stable identity

- **WHEN** a create mutation is delivered or retried
- **THEN** it SHALL carry a stable client-generated entity identity or equivalent deterministic dedupe key
- **AND** the system SHALL resolve retry to the original entity rather than create an unintended duplicate

#### Scenario: Membership action uses a mutable join code

- **WHEN** a delayed membership mutation was initiated from a join code or other mutable lookup
- **THEN** the persisted command SHALL include the immutable intended target resolved when the user initiated the action
- **AND** replay SHALL NOT silently resolve the old lookup value to a different target

### Requirement: Delayed non-database effects use deterministic operation identity

Any delayed mutation that enqueues work, writes files, calls external systems, or schedules process effects SHALL use the stable operation ID or stable entity identity to prevent duplicate logical effects.

#### Scenario: Delayed enqueue is retried

- **WHEN** a delayed mutation retries after background work was already durably accepted
- **THEN** the enqueue boundary SHALL resolve the existing operation-derived job
- **AND** it SHALL NOT create another logical job

#### Scenario: Delayed file mutation is retried

- **WHEN** a delayed media mutation executes more than once during receipt recovery
- **THEN** every execution SHALL target the same intended final path and state
