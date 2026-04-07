## ADDED Requirements

### Requirement: Settings cog opens shell bottom sheet

The mobile shell SHALL display a top-right cogwheel action that opens a HeroUI Native bottom sheet for app preferences.

#### Scenario: Header cog is available from tab destinations

- **WHEN** a user is on a standard tab destination screen in the mobile shell
- **THEN** a settings cog action is visible in the header-right area

#### Scenario: Cog action presents preferences sheet

- **WHEN** the user taps the header settings cog
- **THEN** a HeroUI Native bottom sheet opens from the bottom of the screen
- **AND** the sheet can be dismissed without leaving the current tab route

### Requirement: Appearance mode options are selectable

The preferences bottom sheet SHALL provide appearance mode choices for `light`, `dark`, and `system`.

#### Scenario: User sees all appearance options

- **WHEN** the settings bottom sheet is opened
- **THEN** the user can select Light mode, Dark mode, or System mode

#### Scenario: Current mode is clearly indicated

- **WHEN** the sheet renders appearance controls
- **THEN** the currently active appearance mode is visually indicated as selected

### Requirement: Appearance preference is persisted and applied

The app SHALL persist the selected appearance mode and apply it on subsequent app sessions, defaulting to `system` when no explicit preference exists.

#### Scenario: User changes appearance mode

- **WHEN** the user selects Light, Dark, or System in the bottom sheet
- **THEN** the preference value is saved
- **AND** the app theme updates to the selected mode

#### Scenario: App startup with no saved preference

- **WHEN** the app starts and no appearance preference is stored
- **THEN** the app uses System mode by default

#### Scenario: App startup with saved preference

- **WHEN** the app starts and a saved appearance preference exists
- **THEN** the app applies the saved mode before normal shell interaction
