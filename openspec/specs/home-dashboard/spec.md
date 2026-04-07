# home-dashboard Specification

## Purpose

Defines the mobile recipes home dashboard structure and data-source behavior for Today, Continue Cooking, Discover, and Your Collection sections, including the temporary fixture-only exception for Today meal slots.

## Requirements

### Requirement: Dashboard sections replace flat list as primary screen layout

The recipes tab screen SHALL render a vertically scrollable dashboard composed of named sections above the existing flat recipe list. The sections SHALL appear in order: Today's Meals, Continue Cooking, Discover. The flat recipe list SHALL remain accessible below these sections under a "Your Collection" section header and SHALL be populated from backend-backed dashboard/home data.

#### Scenario: Dashboard sections are visible on home screen load

- **WHEN** the user navigates to the recipes tab
- **THEN** the screen SHALL display a "Today" section, a "Continue Cooking" section, and a "Discover" section before any full recipe cards

#### Scenario: Your Collection remains accessible

- **WHEN** the user scrolls past the dashboard sections
- **THEN** the full swipeable recipe card list SHALL be visible with a "Your Collection" section label

---

### Requirement: Today's Meals section shows planned meals for the day

The home screen SHALL display a "Today" section at the top of the dashboard containing meal slot cards for Breakfast, Lunch, and Dinner using a temporary fixture data source in this change.

#### Scenario: Filled meal slot displays fixture recipe info

- **WHEN** fixture data includes a planned meal for a slot
- **THEN** the slot card SHALL display the slot label, recipe title, and recipe thumbnail image from fixture data

#### Scenario: Empty meal slot shows unplanned state from fixture data

- **WHEN** fixture data indicates no planned meal for a slot
- **THEN** the slot card SHALL display the slot label and an empty-slot affordance

#### Scenario: Tapping a filled meal slot navigates to recipe

- **WHEN** the user taps a filled meal slot card
- **THEN** the app SHALL navigate to or surface that recipe (no-op / console log acceptable for mockup phase)

---

### Requirement: Continue Cooking section shows backend-driven compact recipe cards

The home screen SHALL display a "Continue Cooking" section that renders a horizontally scrollable row of compact recipe cards derived from backend-backed recipe activity data.

#### Scenario: Continue Cooking row renders from backend data

- **WHEN** the home dashboard data query succeeds with continue-cooking items
- **THEN** the section SHALL render compact cards horizontally
- **AND** each card SHALL display thumbnail, title, and duration from backend fields

#### Scenario: Continue Cooking section empty state

- **WHEN** the backend returns no continue-cooking items
- **THEN** the section SHALL render an empty state or omit the row without causing screen errors

---

### Requirement: Discover section shows backend-driven recommendation cards

The home screen SHALL display a "Discover" section that renders a horizontally scrollable row of compact recipe cards derived from backend-backed recommendation data.

#### Scenario: Discover row renders from backend data

- **WHEN** the dashboard query returns discover items
- **THEN** the section SHALL render cards representing available recipe variety
- **AND** each card SHALL display thumbnail, title, and course/category metadata when provided

#### Scenario: Discover section handles empty result

- **WHEN** backend returns zero discover items
- **THEN** the home screen SHALL remain responsive and display a graceful empty state or hidden section behavior

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

The recipes dashboard runtime SHALL allow `TODAYS_MEALS_MOCK` as a temporary data source only for the Today section until planned-meals shared hooks are implemented.

#### Scenario: Only Today depends on temporary fixture

- **WHEN** the recipes dashboard loads in normal runtime mode
- **THEN** Continue Cooking, Discover, and Your Collection SHALL resolve from backend-backed data hooks
- **AND** only Today meal slots MAY resolve from `TODAYS_MEALS_MOCK`
