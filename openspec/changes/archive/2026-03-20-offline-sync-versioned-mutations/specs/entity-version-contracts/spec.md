## ADDED Requirements

### Requirement: Mutable application tables store a monotonic version

The system SHALL store a non-null integer `version` for every Norish-owned application table whose rows can be updated or deleted through normal product workflows.

#### Scenario: Backfilling an existing mutable table

- **WHEN** the version foundation migrates an existing mutable table
- **THEN** each existing row SHALL receive `version = 1`

#### Scenario: Creating a new mutable row

- **WHEN** the system inserts a row into a versioned mutable table
- **THEN** the stored row SHALL start with `version = 1`

#### Scenario: Persisting an authoritative state change

- **WHEN** the system successfully updates a versioned row's authoritative state
- **THEN** the stored row's `version` SHALL increment exactly once before the updated representation is returned

### Requirement: Compare-friendly contracts expose entity versions

Every DTO, query result, or realtime payload that represents a versioned mutable entity SHALL include that entity's current `version`.

#### Scenario: Reading a versioned entity

- **WHEN** a client fetches a versioned mutable entity through a shared read contract
- **THEN** the returned DTO SHALL include the entity's current `version`

#### Scenario: Serializing nested mutable entities

- **WHEN** a response or payload includes nested mutable entities from versioned tables
- **THEN** each nested entity DTO SHALL include its own `version`

#### Scenario: Emitting realtime data for a versioned row

- **WHEN** the server emits a realtime payload that contains a versioned mutable entity
- **THEN** the payload SHALL carry the same `version` value as the authoritative persisted row

### Requirement: Shared contracts preserve version as a numeric comparison token

Shared schemas, DTO aliases, and repository outputs SHALL represent `version` as an integer that callers can persist and compare without format conversion.

#### Scenario: Building future write input from a prior read

- **WHEN** client code stores a `version` value from a prior read DTO
- **THEN** that value SHALL remain a numeric token suitable for later optimistic comparison
