## ADDED Requirements

### Requirement: Web and mobile use one recipe filter contract

The system SHALL define one canonical recipe filter contract (keys, value types, defaults, and option metadata) shared by web and mobile clients.

#### Scenario: Shared contract is consumed by both clients

- **WHEN** web and mobile initialize recipe filter state
- **THEN** both clients use the same filter keys and default values from the shared contract

### Requirement: Mobile dummy filters are replaced by shared definitions

The system SHALL remove dummy filter definitions from mobile flows and use the shared recipe filter definitions.

#### Scenario: Mobile renders real filter options

- **WHEN** a mobile user opens recipe filters
- **THEN** available filters and option metadata match the shared definitions used by web

### Requirement: Filter updates produce consistent payloads

The system SHALL apply filter update semantics and payload serialization consistently across web and mobile.

#### Scenario: Equivalent selections serialize identically

- **WHEN** a user selects equivalent filter values on web and mobile
- **THEN** both clients produce the same normalized filter payload shape for downstream recipe queries
