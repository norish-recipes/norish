## ADDED Requirements
### Requirement: Mobile Recipe Step Auto-Scroll

The recipe preparation step list SHALL auto-scroll on mobile when a step is marked complete.

#### Scenario: Step check scrolls to next incomplete step
- **WHEN** a user on a mobile device checks a preparation step
- **AND** there is a subsequent step that is not yet checked
- **THEN** the view SHALL smoothly scroll so the next incomplete step is brought into view

#### Scenario: No auto-scroll on uncheck
- **WHEN** a user on a mobile device unchecks a preparation step
- **THEN** the view SHALL NOT auto-scroll

#### Scenario: No auto-scroll when no next step
- **WHEN** a user on a mobile device checks the last incomplete preparation step
- **THEN** the view SHALL NOT auto-scroll

#### Scenario: No auto-scroll on desktop
- **WHEN** a user checks a preparation step on a desktop device
- **THEN** the view SHALL NOT auto-scroll
