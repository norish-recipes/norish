## ADDED Requirements

### Requirement: User Hook Architecture Pattern Consistency

The user settings hook stack SHALL follow the established domain hook architecture used by other data domains: query hooks for data reads, cache-helper hooks for observer-free cache writes, and mutation hooks for command execution.

#### Scenario: Mutation hooks avoid query observers

- **WHEN** a user mutation hook is initialized
- **THEN** it SHALL NOT depend on query hooks that create read observers
- **AND** it SHALL use dedicated cache-helper utilities for cache mutation and invalidation

#### Scenario: Query hooks expose canonical cache primitives

- **WHEN** consumer code needs user-settings cache updates
- **THEN** query keys and cache operations SHALL be derived from tRPC query-key builders
- **AND** hardcoded React Query key literals SHALL NOT be used for user-settings rollback/invalidation

### Requirement: User Preferences Type Safety

User preference reads and writes in hooks and settings consumers SHALL be type-safe and SHALL NOT rely on `any` casts.

#### Scenario: Typed preference read in timers/config flow

- **WHEN** the timers-enabled state is derived from global config and user preferences
- **THEN** the implementation SHALL read `timersEnabled` through typed preference access
- **AND** fallback behavior SHALL remain `true` when no explicit boolean preference exists

#### Scenario: Typed preference write in settings flow

- **WHEN** settings UI updates preference values
- **THEN** mutation payloads SHALL use typed preference fields
- **AND** optimistic updates/rollback SHALL preserve typed preference object shape

### Requirement: Deterministic User State Ownership

User settings updates SHALL have a single deterministic state synchronization path between React Query data and user-related contexts.

#### Scenario: Preference update synchronization

- **WHEN** a preference mutation succeeds
- **THEN** user settings consumers SHALL observe the updated preference from the canonical user-settings cache source
- **AND** no competing context write path SHALL overwrite that value with stale data

#### Scenario: Preference mutation failure rollback

- **WHEN** a preference mutation fails
- **THEN** user-settings cache SHALL roll back to the prior value using the canonical tRPC-derived key
- **AND** subsequent invalidation SHALL re-fetch authoritative server state
