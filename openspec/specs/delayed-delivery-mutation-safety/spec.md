## Purpose

Define the safety contract required before a mutation can be delivered later from offline mobile clients without changing the user-intended outcome.

## Requirements

### Requirement: Delayed-delivery eligibility is explicit

The system SHALL queue a mutation for delayed mobile delivery only after that mutation contract has been classified as delayed-delivery-compatible.

#### Scenario: Legacy unsafe mutation remains immediate-only

- **WHEN** a mutation still relies on backend-derived toggle behavior, live container sweeps, ignored version inputs, or mutable live lookups
- **THEN** the system SHALL NOT classify that mutation as delayed-delivery-compatible

#### Scenario: Migrated mutation becomes eligible

- **WHEN** a mutation contract carries explicit intent, enforces any required version checks, and scopes destructive work to the original request snapshot or deterministic target
- **THEN** the system SHALL allow that mutation to be marked delayed-delivery-compatible

#### Scenario: First rollout excludes create-style mutations

- **WHEN** a mutation creates a new entity or resolves membership from a mutable lookup such as a join code
- **THEN** the system SHALL keep that mutation off the first delayed-delivery allowlist
- **AND** it SHALL continue to run only as an immediate mutation until a later deterministic contract exists

#### Scenario: Security-sensitive mutation satisfies the same safety contract

- **WHEN** a security-sensitive mutation carries explicit targeting and any required version or snapshot preconditions
- **THEN** the system SHALL allow that mutation to be classified delayed-delivery-compatible using the same eligibility rules as other mutations

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

Any delayed-delivery-compatible mutation that creates a new entity or resolves a target by lookup SHALL carry a deterministic identity or target that still refers to the same intended result when delivered later.

#### Scenario: Delayed create provides a stable identity

- **WHEN** a delayed create mutation includes a stable client-generated entity identity or equivalent deterministic dedupe key
- **THEN** the system SHALL use that identity or key so the delayed request does not create an unintended duplicate entity

#### Scenario: Mutable live lookup lacks deterministic targeting

- **WHEN** a create or membership mutation can only resolve its target from mutable live server state at delivery time
- **THEN** the system SHALL NOT classify that mutation as delayed-delivery-compatible until its contract carries a deterministic target
