## ADDED Requirements

### Requirement: Mobile dashboard uses shared recipe context live data

The system SHALL wire the mobile dashboard recipe surfaces to the shared recipe context so recipe lists receive live updates from actual data sources. Additionally, the mobile recipe detail screen SHALL consume live data from the same shared recipe data pipeline.

#### Scenario: Dashboard list updates when new recipe arrives

- **WHEN** a new recipe is emitted by the shared/live recipe data flow
- **THEN** the mobile dashboard recipe list reflects the new item without requiring a manual refresh

#### Scenario: Recipe detail screen loads live data

- **WHEN** a user navigates from the dashboard to a recipe detail screen
- **THEN** the detail screen fetches and displays the full recipe from the backend using the shared recipe query hooks

### Requirement: Mobile search page uses actual recipe data

The system SHALL replace placeholder or dummy search data on mobile with actual recipe data from the shared query/context contract.

#### Scenario: Search results come from actual data source

- **WHEN** a mobile user executes a recipe search query
- **THEN** results are sourced from the real recipe data pipeline and follow shared filter/search contracts

### Requirement: Dashboard and search use consistent data contract

The system SHALL ensure mobile dashboard and search consume the same normalized recipe entity shape and update semantics provided by shared modules.

#### Scenario: Shared entity shape across dashboard and search

- **WHEN** dashboard and search render the same recipe
- **THEN** both surfaces receive compatible data fields and render without page-specific data adapters
