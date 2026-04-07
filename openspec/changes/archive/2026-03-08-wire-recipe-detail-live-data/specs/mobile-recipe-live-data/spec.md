## MODIFIED Requirements

### Requirement: Mobile dashboard uses shared recipe context live data

The system SHALL wire the mobile dashboard recipe surfaces to the shared recipe context so recipe lists receive live updates from actual data sources. Additionally, the mobile recipe detail screen SHALL consume live data from the same shared recipe data pipeline.

#### Scenario: Dashboard list updates when new recipe arrives

- **WHEN** a new recipe is emitted by the shared/live recipe data flow
- **THEN** the mobile dashboard recipe list reflects the new item without requiring a manual refresh

#### Scenario: Recipe detail screen loads live data

- **WHEN** a user navigates from the dashboard to a recipe detail screen
- **THEN** the detail screen fetches and displays the full recipe from the backend using the shared recipe query hooks
