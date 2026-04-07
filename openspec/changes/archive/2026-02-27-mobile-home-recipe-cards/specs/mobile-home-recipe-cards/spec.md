## ADDED Requirements

### Requirement: Mobile home shows recipe card list

The mobile application SHALL render the home surface as a vertically scrollable list of recipe cards representing the user's recipes.

#### Scenario: Home renders recipe list

- **WHEN** a user opens the mobile home screen
- **THEN** the app SHALL display a vertical list of recipe cards
- **AND** each list item SHALL map to one recipe record from the home data source

#### Scenario: Empty recipe set

- **WHEN** the home data source contains no recipes
- **THEN** the app SHALL show an empty-state message indicating no recipes are available
- **AND** the screen SHALL remain functional without errors

### Requirement: Recipe card exposes required metadata

Each mobile recipe card SHALL present the recipe image, title, description limited to two lines, servings, rating as a 1-5 star display, tags, course, liked state as a heart icon, and total duration.

#### Scenario: Card displays all metadata fields

- **WHEN** a recipe card is rendered
- **THEN** the card SHALL show all required metadata fields
- **AND** the description text SHALL be clamped to at most two lines

#### Scenario: Rating display bounds

- **WHEN** a recipe card includes a rating value
- **THEN** the star display SHALL render a value between 1 and 5 inclusive
- **AND** values outside this range SHALL be normalized before display

### Requirement: Home supports mock data source for initial delivery

The first implementation SHALL provide a deterministic mock recipe dataset so the home list can be developed and reviewed before backend integration.

#### Scenario: Mock data populates home list

- **WHEN** backend recipe retrieval is not enabled
- **THEN** the home list SHALL render using an in-app mock dataset
- **AND** the mock dataset SHALL include values for all required card metadata fields
