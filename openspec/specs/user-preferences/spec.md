# user-preferences Specification

## Purpose

TBD - created by archiving change add-rating-like-visibility-preferences. Update Purpose after archive.

## Requirements

### Requirement: Rating visibility preference

The system SHALL store a `showRatings` boolean in the user's `preferences` JSONB column that controls visibility of all rating-related UI. The preference SHALL default to `true` when unset.

#### Scenario: Ratings visible by default

- **WHEN** a user has never set the `showRatings` preference
- **THEN** the system treats `showRatings` as `true`
- **AND** all rating UI elements (star ratings on recipe cards, recipe detail pages) are displayed

#### Scenario: User hides ratings

- **WHEN** a user sets `showRatings` to `false` via `updatePreferences({ showRatings: false })`
- **THEN** star ratings are hidden on recipe cards and recipe detail pages
- **AND** the minimum rating filter is removed from the filters panel

#### Scenario: User re-enables ratings

- **WHEN** a user sets `showRatings` to `true` via `updatePreferences({ showRatings: true })`
- **THEN** all rating UI elements are displayed again
- **AND** the minimum rating filter reappears in the filters panel

### Requirement: Favorites visibility preference

The system SHALL store a `showFavorites` boolean in the user's `preferences` JSONB column that controls visibility of all favorite/like-related UI. The preference SHALL default to `true` when unset.

#### Scenario: Favorites visible by default

- **WHEN** a user has never set the `showFavorites` preference
- **THEN** the system treats `showFavorites` as `true`
- **AND** all favorite UI elements (heart icons on recipe cards, recipe detail pages) are displayed

#### Scenario: User hides favorites

- **WHEN** a user sets `showFavorites` to `false` via `updatePreferences({ showFavorites: false })`
- **THEN** heart/favorite icons are hidden on recipe cards and recipe detail pages
- **AND** the favorites-only toggle is removed from the filters panel

#### Scenario: User re-enables favorites

- **WHEN** a user sets `showFavorites` to `true` via `updatePreferences({ showFavorites: true })`
- **THEN** all favorite UI elements are displayed again
- **AND** the favorites-only toggle reappears in the filters panel

### Requirement: Rating and favorites visibility toggles in settings

The PreferencesCard in user settings SHALL include toggle switches for `showRatings` and `showFavorites`, allowing users to control visibility of these features.

#### Scenario: Toggle switches display current state

- **WHEN** an authenticated user views the PreferencesCard on the settings page
- **THEN** a toggle for "Show Ratings" is displayed, reflecting the current `showRatings` value (defaulting to enabled)
- **AND** a toggle for "Show Favorites" is displayed, reflecting the current `showFavorites` value (defaulting to enabled)

#### Scenario: User disables ratings from settings

- **WHEN** the user toggles the "Show Ratings" switch off
- **THEN** `updatePreferences({ showRatings: false })` is called
- **AND** the toggle reflects the disabled state

#### Scenario: User disables favorites from settings

- **WHEN** the user toggles the "Show Favorites" switch off
- **THEN** `updatePreferences({ showFavorites: false })` is called
- **AND** the toggle reflects the disabled state

### Requirement: Filters panel adapts to visibility preferences

The filters panel SHALL omit rating and favorites filter controls when the corresponding visibility preference is disabled for the current user.

#### Scenario: Both preferences disabled hides entire section

- **WHEN** `showRatings` is `false` and `showFavorites` is `false`
- **THEN** the "Favorites & Rating" section is not rendered in the filters panel

#### Scenario: Only ratings disabled

- **WHEN** `showRatings` is `false` and `showFavorites` is `true`
- **THEN** the favorites-only toggle is rendered in the filters panel
- **AND** the minimum rating filter (RatingStars) is not rendered

#### Scenario: Only favorites disabled

- **WHEN** `showFavorites` is `false` and `showRatings` is `true`
- **THEN** the minimum rating filter (RatingStars) is rendered in the filters panel
- **AND** the favorites-only toggle is not rendered
