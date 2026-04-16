## MODIFIED Requirements

### Requirement: Today's Meals section shows planned meals for the day

The home screen SHALL display a "Today" section at the top of the dashboard containing meal slot cards for Breakfast, Lunch, and Dinner using a temporary fixture data source in this change.

#### Scenario: Filled meal slot displays fixture recipe info

- **WHEN** fixture data includes a planned meal for a slot
- **THEN** the slot card SHALL display the slot label, recipe title, and recipe thumbnail image from fixture data

#### Scenario: Empty meal slot shows unplanned state from fixture data

- **WHEN** fixture data indicates no planned meal for a slot
- **THEN** the slot card SHALL display the slot label and an empty-slot affordance

### Requirement: Continue Cooking section shows backend-driven compact recipe cards

The home screen SHALL display a "Continue Cooking" section that renders a horizontally scrollable row of compact recipe cards derived from backend-backed recipe activity data.

#### Scenario: Continue Cooking row renders from backend data

- **WHEN** the home dashboard data query succeeds with continue-cooking items
- **THEN** the section SHALL render compact cards horizontally
- **AND** each card SHALL display thumbnail, title, and duration from backend fields

#### Scenario: Continue Cooking section empty state

- **WHEN** the backend returns no continue-cooking items
- **THEN** the section SHALL render an empty state or omit the row without causing screen errors

### Requirement: Discover section shows backend-driven recommendation cards

The home screen SHALL display a "Discover" section that renders a horizontally scrollable row of compact recipe cards derived from backend-backed recommendation data.

#### Scenario: Discover row renders from backend data

- **WHEN** the dashboard query returns discover items
- **THEN** the section SHALL render cards representing available recipe variety
- **AND** each card SHALL display thumbnail, title, and course/category metadata when provided

#### Scenario: Discover section handles empty result

- **WHEN** backend returns zero discover items
- **THEN** the home screen SHALL remain responsive and display a graceful empty state or hidden section behavior

### Requirement: Today's Meals mock data type and fixture exist

The recipes dashboard runtime SHALL allow `TODAYS_MEALS_MOCK` as a temporary data source only for the Today section until planned-meals shared hooks are implemented.

#### Scenario: Only Today depends on temporary fixture

- **WHEN** the recipes dashboard loads in normal runtime mode
- **THEN** Continue Cooking, Discover, and Your Collection SHALL resolve from backend-backed data hooks
- **AND** only Today meal slots MAY resolve from `TODAYS_MEALS_MOCK`
