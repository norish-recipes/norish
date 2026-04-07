## ADDED Requirements

### Requirement: Settings cogwheel button is visible in both light and dark mode

The shell header settings button SHALL use a background color that provides sufficient contrast against the app's background surface in both light and dark mode. The current `rgba(255,255,255,0.08)` iOS background color SHALL be replaced with a neutral adaptive value that remains visible regardless of theme.

#### Scenario: Cogwheel is visible on light mode

- **WHEN** the app is in light mode (background near-white oklch 97%)
- **THEN** the settings button background SHALL be visually distinct from the screen background, with a contrast ratio sufficient to perceive the circular button shape

#### Scenario: Cogwheel remains visible on dark mode

- **WHEN** the app is in dark mode (background near-black oklch 12%)
- **THEN** the settings button background SHALL continue to be visible as it was before this fix

#### Scenario: Settings button border is visible in light mode

- **WHEN** the app is in light mode
- **THEN** the glassWrap border (iOS only) SHALL use a color that creates a visible outline against the light background

#### Scenario: Settings button retains blur effect on iOS

- **WHEN** the settings button is rendered on iOS in either light or dark mode
- **THEN** the BlurView SHALL remain present and functional — only the container background and border colors are changed, not the blur mechanism itself

#### Scenario: Android settings button is also visible in light mode

- **WHEN** the app is running on Android in light mode
- **THEN** the settings button background (`settingsButtonDefault`) SHALL provide visible contrast (the existing `rgba(127,127,127,0.12)` may be increased if insufficient)
