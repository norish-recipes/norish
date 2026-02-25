# mobile-ui Specification Delta

## ADDED Requirements

### Requirement: Mobile Recipe Dashboard Card Grid

The mobile app SHALL provide a recipe dashboard card grid that recreates the core Norish dashboard card presentation for mobile screens.

#### Scenario: Recipe cards render in a dashboard-style grid

- **WHEN** a user opens the mobile app dashboard route
- **THEN** recipe cards SHALL be rendered in a grid layout optimized for phone screens
- **AND** card spacing and sizing SHALL support scrolling through multiple recipes efficiently

#### Scenario: Card content mirrors core dashboard hierarchy

- **WHEN** a recipe card is displayed in the mobile grid
- **THEN** the card SHALL show a recipe thumbnail (or fallback), title, and summary text if available
- **AND** the card SHALL include key metadata/tags used in the Norish dashboard card pattern when those fields are available

### Requirement: Native Recipe Card Action Menu

Each mobile recipe card SHALL expose a basic action menu using platform-native menu presentation and styling.

#### Scenario: User opens the card menu

- **WHEN** a user presses the card menu trigger
- **THEN** the app SHALL present a menu using the device's native menu surface and styling conventions
- **AND** the menu SHALL avoid custom web-style dropdown chrome

#### Scenario: Basic recipe actions are available from menu

- **WHEN** the native menu is displayed for a recipe card
- **THEN** the menu SHALL include at least open/view and one additional recipe action
- **AND** selecting a menu option SHALL invoke its corresponding handler for that recipe
