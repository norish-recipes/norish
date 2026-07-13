## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Delayed non-database effects use deterministic operation identity

Any delayed mutation that enqueues work, writes files, calls external systems, or schedules process effects SHALL use the stable operation ID or stable entity identity to prevent duplicate logical effects.

#### Scenario: Delayed enqueue is retried

- **WHEN** a delayed mutation retries after background work was already durably accepted
- **THEN** the enqueue boundary SHALL resolve the existing operation-derived job
- **AND** it SHALL NOT create another logical job

#### Scenario: Delayed file mutation is retried

- **WHEN** a delayed media mutation executes more than once during receipt recovery
- **THEN** every execution SHALL target the same intended final path and state
