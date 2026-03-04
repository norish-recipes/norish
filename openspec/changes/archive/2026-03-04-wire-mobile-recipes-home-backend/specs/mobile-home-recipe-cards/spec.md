## MODIFIED Requirements

### Requirement: Mobile home shows recipe card list

The mobile application SHALL render the home surface as a vertically scrollable list of recipe cards representing the user's recipes retrieved from the backend-backed home data source.

#### Scenario: Home renders recipe list from backend data

- **WHEN** a user opens the mobile home screen and recipe data is successfully fetched
- **THEN** the app SHALL display a vertical list of recipe cards
- **AND** each list item SHALL map to one recipe record returned by the backend-backed home query

#### Scenario: Home displays loading state during fetch

- **WHEN** a user opens the mobile home screen and recipe data request is in progress
- **THEN** the app SHALL show a loading state for the recipe list region
- **AND** the app SHALL NOT render stale mock recipe records

#### Scenario: Empty recipe set

- **WHEN** the backend-backed home data source returns no recipes
- **THEN** the app SHALL show an empty-state message indicating no recipes are available
- **AND** the screen SHALL remain functional without errors

#### Scenario: Backend fetch fails

- **WHEN** the recipe data request fails due to network, auth, or server error
- **THEN** the app SHALL show an error state for the home recipe list
- **AND** the app SHALL keep the rest of the home screen responsive

### Requirement: Home supports mock data source for initial delivery

The mobile home recipe list SHALL use backend-backed recipe retrieval as the default production data source and SHALL NOT depend on a built-in mock dataset for normal runtime behavior.

#### Scenario: Home uses backend source by default

- **WHEN** backend recipe retrieval is enabled for mobile runtime
- **THEN** the home list SHALL load from backend-backed recipe queries
- **AND** the app SHALL NOT require deterministic in-app mock records to render recipe cards

#### Scenario: Backend source unavailable

- **WHEN** backend recipe retrieval cannot execute because connectivity or session prerequisites are missing
- **THEN** the app SHALL present the corresponding loading or error state
- **AND** SHALL NOT silently substitute mock recipe records as production behavior
