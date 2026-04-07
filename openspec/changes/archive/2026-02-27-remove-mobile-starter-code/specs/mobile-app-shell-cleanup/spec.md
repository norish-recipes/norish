## ADDED Requirements

### Requirement: Mobile app shell excludes starter-template routes

The mobile application SHALL expose only product-relevant top-level routes and SHALL NOT ship starter walkthrough routes.

#### Scenario: Explore starter route removed

- **WHEN** the app route manifest is resolved for native or web
- **THEN** no `explore` route SHALL be registered
- **AND** app navigation SHALL remain functional without route resolution errors

### Requirement: Starter-only shared modules are removed from runtime graph

The mobile codebase SHALL remove starter-template shared modules that are not required by active product screens.

#### Scenario: Build has no imports to deleted starter helpers

- **WHEN** the mobile app is typechecked or bundled
- **THEN** there SHALL be no import references to removed starter files
- **AND** the build SHALL complete without missing-module errors

### Requirement: Active home surface remains available after cleanup

The mobile cleanup SHALL preserve the existing product home surface behavior.

#### Scenario: Home screen still renders recipe feed

- **WHEN** a user opens the mobile app after cleanup
- **THEN** the home route SHALL render the recipe list surface
- **AND** recipe card list interactions supported before cleanup SHALL remain available
