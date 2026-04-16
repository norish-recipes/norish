# mobile-home-recipe-cards Specification

## Purpose

Defines the home screen recipe card list for the mobile app — a vertically scrollable list of recipe cards with swipeable actions and a structured card body.

## Requirements

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

### Requirement: Recipe card exposes required metadata

Each mobile recipe card SHALL present the recipe image, title, description limited to two lines, servings, rating as a 1-5 star display, tags, course, liked state as a heart icon, and total duration. The recipe image SHALL be resolved using the canonical `resolveImageUrl` helper from `resolve-image-url.ts`, and SHALL render a `NoImagePlaceholder` when the image URL is missing or fails to load.

#### Scenario: Card displays all metadata fields

- **WHEN** a recipe card is rendered
- **THEN** the card SHALL show all required metadata fields
- **AND** the description text SHALL be clamped to at most two lines

#### Scenario: Rating display bounds

- **WHEN** a recipe card includes a rating value
- **THEN** the star display SHALL render a value between 1 and 5 inclusive
- **AND** values outside this range SHALL be normalized before display

#### Scenario: Card image resolved via canonical helper

- **WHEN** a recipe card is constructed from a `RecipeDashboardDTO`
- **THEN** the image URL SHALL be resolved using `resolveImageUrl` from `resolve-image-url.ts`
- **AND** auth cookie headers SHALL be attached to the image source when available

#### Scenario: Card image fails to load

- **WHEN** the recipe card image URL returns a 404 or network error
- **THEN** the card SHALL render a `NoImagePlaceholder` component in place of the broken image

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
