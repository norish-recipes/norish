## ADDED Requirements

### Requirement: Today section uses shared planned-meals hooks
The Today section SHALL source runtime data from shared planned-meals query/subscription hooks instead of fixture adapters.

#### Scenario: Mobile Today section renders from backend hooks
- **GIVEN** shared planned-meals query hooks are available
- **WHEN** mobile home dashboard loads
- **THEN** Today slots render from planned-meals backend data
- **AND** no runtime fixture adapter is used for Today cards.

### Requirement: Planned-meals updates apply in realtime
The shared planned-meals subscription hooks SHALL update Today section cache state for created/updated/deleted meal items.

#### Scenario: Planned meal item changes
- **GIVEN** a client is subscribed to planned-meals updates
- **WHEN** a planned meal item is created/updated/deleted
- **THEN** Today section state updates without a full page reload.
