## ADDED Requirements

### Requirement: Platform-agnostic standalone hooks are provided from shared-react

`@norish/shared-react` SHALL expose standalone hooks that contain no platform-specific dependencies and are useful across web and mobile.

#### Scenario: Amount display preference hook is available from shared-react

- **WHEN** web or mobile needs to format amounts for display
- **THEN** `useAmountDisplayPreference` SHALL be importable from `@norish/shared-react/hooks`

#### Scenario: Recurrence detection hook is available from shared-react

- **WHEN** web or mobile needs to detect recurrence patterns
- **THEN** `useRecurrenceDetection` SHALL be importable from `@norish/shared-react/hooks`

### Requirement: Platform-specific standalone hooks remain in their respective apps

Hooks that depend on browser-specific or native-specific APIs SHALL remain in their respective app directories.

#### Scenario: Browser-specific hooks stay in web

- **WHEN** a hook depends on browser APIs (clipboard, IntersectionObserver, localStorage, WakeLock, resize observer)
- **THEN** it SHALL remain in the web app's hooks directory
- **AND** it SHALL NOT be moved to shared-react
