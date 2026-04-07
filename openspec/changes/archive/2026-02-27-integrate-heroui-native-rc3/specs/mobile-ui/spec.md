## ADDED Requirements

### Requirement: Start screen uses HeroUI Card

The mobile start screen SHALL render its primary starter panel using a HeroUI Native `Card` component instead of ad hoc custom card primitives.

#### Scenario: Starter content renders inside HeroUI card

- **WHEN** the start screen loads
- **THEN** the starter panel SHALL be implemented with HeroUI `Card` composition
- **AND** the existing starter content and information hierarchy SHALL remain visible to the user

#### Scenario: Starter card preserves existing behavior

- **WHEN** a user interacts with actions or links contained in the starter panel
- **THEN** the behavior SHALL match the previous start screen behavior
- **AND** replacing the card container SHALL NOT change navigation outcomes
