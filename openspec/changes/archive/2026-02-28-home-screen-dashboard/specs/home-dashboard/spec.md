## ADDED Requirements

### Requirement: Dashboard sections replace flat list as primary screen layout

The recipes tab screen SHALL render a vertically scrollable dashboard composed of named sections above the existing flat recipe list. The sections SHALL appear in order: Today's Meals, Continue Cooking, Discover. The flat recipe list SHALL remain accessible below these sections under a "Your Collection" section header.

#### Scenario: Dashboard sections are visible on home screen load

- **WHEN** the user navigates to the recipes tab
- **THEN** the screen SHALL display a "Today" section, a "Continue Cooking" section, and a "Discover" section before any full recipe cards

#### Scenario: Your Collection remains accessible

- **WHEN** the user scrolls past the dashboard sections
- **THEN** the full swipeable recipe card list SHALL be visible with a "Your Collection" section label

---

### Requirement: Today's Meals section shows planned meals for the day

The home screen SHALL display a "Today" section at the top of the dashboard containing a horizontal row of meal slot cards — one each for Breakfast, Lunch, and Dinner. Each slot card SHALL show the recipe name and a thumbnail image when a meal is planned. When no meal is planned for a slot, the card SHALL display a "+" placeholder indicating the slot is empty. All data SHALL be static mock data for this phase.

#### Scenario: Filled meal slot displays recipe info

- **WHEN** a meal is planned for a slot (mock data contains a recipe for that slot)
- **THEN** the slot card SHALL display the slot label (e.g., "Breakfast"), the recipe title, and the recipe thumbnail image

#### Scenario: Empty meal slot shows add prompt

- **WHEN** no meal is planned for a slot (mock data has null recipeId for that slot)
- **THEN** the slot card SHALL display the slot label and a "+" visual affordance to indicate an empty slot

#### Scenario: Tapping a filled meal slot navigates to recipe

- **WHEN** the user taps a filled meal slot card
- **THEN** the app SHALL navigate to or surface that recipe (no-op / console log acceptable for mockup phase)

---

### Requirement: Continue Cooking section shows horizontally scrollable compact recipe cards

The home screen SHALL display a "Continue Cooking" section below Today's Meals, containing a horizontally scrollable row of compact recipe cards. The section SHALL use a subset of mock recipes to simulate recently interacted items. Each compact card SHALL show the recipe image, title, and estimated duration.

#### Scenario: Continue Cooking row renders multiple cards horizontally

- **WHEN** the home screen is loaded
- **THEN** the Continue Cooking section SHALL render at least two compact recipe cards in a horizontal scroll row

#### Scenario: Compact card displays key recipe info

- **WHEN** a compact card is rendered
- **THEN** it SHALL display the recipe thumbnail, title (truncated to one line), and total duration in minutes

---

### Requirement: Discover section shows horizontally scrollable variety cards

The home screen SHALL display a "Discover" section below Continue Cooking, containing a horizontally scrollable row of compact recipe cards drawn from a different subset of mock data to simulate variety suggestions. Each card SHALL show the recipe image, title, and course type.

#### Scenario: Discover row renders with variety of course types

- **WHEN** the home screen is loaded
- **THEN** the Discover section SHALL render compact cards representing different course types (e.g., Breakfast, Lunch, Dinner)

#### Scenario: Discover cards display course type

- **WHEN** a Discover compact card is rendered
- **THEN** it SHALL display the recipe thumbnail, title, and course label

---

### Requirement: Compact recipe card component exists as a separate component

A `CompactRecipeCard` component SHALL exist in `apps/mobile/src/components/home/` and SHALL be usable independently of the full-size `MobileRecipeCard`. It SHALL accept a recipe item prop and render in a fixed-width square or portrait format suitable for horizontal scroll rows. It SHALL have no swipe actions.

#### Scenario: CompactRecipeCard renders without swipe actions

- **WHEN** a CompactRecipeCard is rendered
- **THEN** no swipe gesture handlers SHALL be attached and no swipe action buttons SHALL be visible

#### Scenario: CompactRecipeCard has a fixed width suitable for horizontal rows

- **WHEN** a CompactRecipeCard is rendered in a horizontal ScrollView
- **THEN** it SHALL have a fixed width (e.g., 140–160px) that allows multiple cards to be partially visible

---

### Requirement: Today's Meals mock data type and fixture exist

A `PlannedMeal` type and a `TODAYS_MEALS_MOCK` fixture SHALL exist in `apps/mobile/src/lib/` to supply the Today's Meals section with data. The type SHALL include slot, recipeId (nullable), recipeTitle (nullable), imageUrl (nullable), and totalDurationMinutes (nullable) fields.

#### Scenario: Mock data covers all three meal slots

- **WHEN** the TODAYS_MEALS_MOCK fixture is imported
- **THEN** it SHALL contain exactly three entries — one for each of Breakfast, Lunch, and Dinner

#### Scenario: At least one mock slot has a recipe assigned

- **WHEN** the TODAYS_MEALS_MOCK fixture is loaded
- **THEN** at least one slot SHALL have a non-null recipeId linking to an entry in recipe-mock-data
