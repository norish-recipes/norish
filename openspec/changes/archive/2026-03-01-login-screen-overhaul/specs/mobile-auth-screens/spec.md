## MODIFIED Requirements

### Requirement: Unified Auth Screen Styling

The connect screen, login screen, and register screen SHALL share a consistent visual layout that matches the web auth experience, including the brand logo.

#### Scenario: Brand logo displayed on all auth screens

- **WHEN** any of the connect, login, or register screens is displayed
- **THEN** the `logo.svg` brand logo (copied from `apps/web/public/logo.svg`) SHALL be rendered at the top of the screen via `react-native-svg`
- **AND** no text-only "Norish" eyebrow label SHALL be used in place of the logo image

#### Scenario: Content is centered without a scrollbar

- **WHEN** any auth screen is displayed and the keyboard is not visible
- **THEN** the screen content SHALL be vertically centered within the available viewport
- **AND** no scroll indicator SHALL be visible
- **AND** no content SHALL overflow the screen boundaries

#### Scenario: Keyboard avoidance without layout jump

- **WHEN** the user taps a text input on an auth screen and the keyboard appears
- **THEN** the visible content SHALL remain accessible above the keyboard
- **AND** no scrollbar or layout jump SHALL occur

#### Scenario: Visual consistency between connect and login

- **WHEN** the connect screen and login screen are displayed
- **THEN** both SHALL use the same layout structure: brand logo, large title, subtitle, card content area
- **AND** both SHALL use matching font sizes, padding, and spacing values

#### Scenario: Transition between connect and login

- **WHEN** the user navigates from the connect screen to the login screen
- **THEN** a smooth animation SHALL play (fade or slide)
- **AND** both screens SHALL be within the `(auth)` route group sharing a `Stack` navigator
