# Recipe Timers Capability Specification

## ADDED Requirements

### Requirement: Timer Detection in Recipe Steps

The system SHALL automatically detect time durations in recipe instruction text and render them as interactive timer buttons.

#### Scenario: English time duration detected

- **WHEN** a recipe step contains "bake for 20 minutes"
- **THEN** the text "20 minutes" SHALL be rendered as an interactive timer button
- **AND** clicking the button SHALL start a 20-minute countdown timer

#### Scenario: Time range with lower bound

- **WHEN** a recipe step contains "simmer for 5-10 minutes"
- **THEN** a timer button SHALL be created with 5 minutes duration (lower bound)

#### Scenario: Multiple timers in one step

- **WHEN** a recipe step contains "bake for 20 minutes then rest for 1 hour"
- **THEN** two separate timer buttons SHALL be rendered
- **AND** each timer SHALL be independently controllable

### Requirement: Configurable Timer Detection Keywords

The system SHALL use configurable keywords to detect time durations in recipe text, following the same pattern as content indicators.

#### Scenario: Default keywords detect common patterns

- **WHEN** timer keywords config contains ["minute", "minutes", "hour", "hours"]
- **AND** a recipe step contains "bake for 20 minutes"
- **THEN** "20 minutes" SHALL be detected and rendered as a timer button

#### Scenario: Multilingual keyword support

- **WHEN** timer keywords include ["minuten", "stunden"] (German)
- **AND** a recipe step contains "20 Minuten backen"
- **THEN** "20 Minuten" SHALL be detected and rendered as a timer button

#### Scenario: Custom keywords added by admin

- **WHEN** admin adds custom keyword "dakika" (Turkish for minute)
- **AND** a recipe step contains "10 dakika"
- **THEN** "10 dakika" SHALL be detected and rendered as a timer button

#### Scenario: Case-insensitive keyword matching

- **WHEN** timer keywords contain "minute"
- **AND** a recipe step contains "20 MINUTES" or "20 Minutes"
- **THEN** the text SHALL be detected regardless of case

### Requirement: Timer State Management

The system SHALL persist timer state across page navigation and browser sessions using Zustand with localStorage.

#### Scenario: Timer continues after navigation

- **WHEN** user starts a timer and navigates to another page
- **THEN** the timer SHALL continue running
- **AND** the floating timer dock SHALL remain visible

#### Scenario: Timer persists across browser restart

- **WHEN** user has active timers and closes the browser
- **AND** user reopens the browser within the timer duration
- **THEN** active timers SHALL be restored with correct remaining time

### Requirement: Multiple Concurrent Timers

The system SHALL support multiple timers running simultaneously with a unified management interface.

#### Scenario: Multiple timers shown in dock

- **WHEN** user has 3 active timers from different recipe steps
- **THEN** all timers SHALL be visible in the expanded timer dock
- **AND** timers SHALL be sorted with completed timers first, then by remaining time

#### Scenario: Timer adjustment controls

- **WHEN** user views a running timer in the dock
- **THEN** plus and minus buttons SHALL be available
- **AND** increment amount SHALL adjust based on timer duration (10s for <5min, 1min for <20min, 5min for ≥20min)

### Requirement: Timer Completion Notification

The system SHALL provide audio and visual alerts when a timer completes.

#### Scenario: Timer completion alert

- **WHEN** a timer reaches 0:00
- **THEN** an audio alert SHALL play continuously until dismissed
- **AND** the timer SHALL display in red with pulsing animation
- **AND** the floating dock SHALL show the completed timer prominently

#### Scenario: Dismissing completed timer

- **WHEN** user clicks the "Done" button on a completed timer
- **THEN** the audio alert SHALL stop
- **AND** the timer SHALL be removed from the dock

### Requirement: Admin Configuration for Timer Detection

The system SHALL provide admin controls for timer detection configuration in the Content Detection settings section, using the isOverridden pattern to allow default updates.

#### Scenario: Enable/disable timer feature

- **WHEN** admin toggles timer detection to disabled
- **THEN** no timer buttons SHALL appear in recipe steps
- **AND** the timer dock SHALL not be rendered

#### Scenario: Edit timer detection keywords

- **WHEN** admin views Content Detection settings
- **THEN** a "Timer Keywords" section SHALL be displayed
- **AND** a JSON editor SHALL allow editing the keywords array
- **AND** the editor SHALL follow the same pattern as content indicators

#### Scenario: Default timer keywords on fresh install

- **WHEN** Norish is freshly installed
- **THEN** timer detection SHALL be enabled by default
- **AND** default keywords SHALL include common time units for EN, DE, FR, NL
- **AND** isOverridden SHALL be false

#### Scenario: Custom keywords set isOverridden flag

- **WHEN** admin edits and saves timer keywords
- **THEN** isOverridden SHALL be automatically set to true
- **AND** future default keyword additions SHALL NOT affect the user's configuration

#### Scenario: Reset to defaults clears override

- **WHEN** admin clicks "Reset to Defaults" button
- **THEN** isOverridden SHALL be set to false
- **AND** the system SHALL use default keywords from config/timer-keywords.default.json
- **AND** future default keyword additions SHALL automatically be included

#### Scenario: Default keyword updates benefit non-overridden configs

- **WHEN** a new default keyword is added to timer-keywords.default.json
- **AND** isOverridden is false for a user's configuration
- **THEN** the new keyword SHALL be automatically available for timer detection
- **AND** no admin intervention SHALL be required

### Requirement: Markdown Compatibility

Timer detection SHALL NOT interfere with markdown rendering in recipe instructions.

#### Scenario: Active step with markdown and timer

- **WHEN** a recipe step contains "Bake at **450°F** for 20 minutes"
- **AND** the step is active (not completed)
- **THEN** "450°F" SHALL be rendered in bold
- **AND** "20 minutes" SHALL be rendered as a timer button
- **AND** all other markdown formatting SHALL be preserved

#### Scenario: Completed step maintains original rendering

- **WHEN** a recipe step is marked as done
- **THEN** the step SHALL render with SmartMarkdownRenderer
- **AND** no timer buttons SHALL be shown (original behavior preserved)

### Requirement: Icon Consistency

All timer-related UI components SHALL use HeroIcons to maintain consistency with the rest of the application.

#### Scenario: Timer icons from HeroIcons library

- **WHEN** timer components are rendered
- **THEN** all icons (play, pause, trash, plus, minus, chevron, etc.) SHALL be imported from @heroicons/react
- **AND** no icons from lucide-react or other libraries SHALL be used
