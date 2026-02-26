## ADDED Requirements

### Requirement: Native Bottom Tab Navigation for Recipe Dashboard

The mobile app SHALL provide a recipe dashboard shell using Expo Router native tabs as the primary bottom navigation system, aligned with the Expo native-tabs guidance (`https://docs.expo.dev/router/advanced/native-tabs/`).

#### Scenario: Native tabs are used for dashboard navigation

- **WHEN** the mobile dashboard shell is rendered
- **THEN** bottom navigation SHALL be implemented with Expo Router native tabs
- **AND** the tab bar SHALL use platform-native behavior and layout conventions

#### Scenario: Dedicated search tab is available

- **WHEN** the user views the bottom navigation
- **THEN** a dedicated Search tab SHALL be present as its own navigation destination
- **AND** selecting Search SHALL navigate to a distinct search route
- **AND** the implementation SHALL follow Expo separate-search-tab behavior guidance (`https://docs.expo.dev/router/advanced/native-tabs/#separate-search-tab`)

#### Scenario: Tab bar minimizes on scroll

- **WHEN** the user scrolls downward in a tab screen that supports scrolling content
- **THEN** the native tab bar SHALL minimize according to Expo native-tab minimize behavior
- **AND** the tab bar SHALL remain discoverable through platform-native restore behavior
- **AND** the behavior SHALL follow Expo tab-bar minimize guidance (`https://docs.expo.dev/router/advanced/native-tabs/#tab-bar-minimize-behavior`)

### Requirement: Dashboard Shell Removes Parallel React Navigation Dependencies

The mobile dashboard shell SHALL avoid parallel React Navigation package dependencies and rely on Expo Router native navigation primitives for this capability.

#### Scenario: Mobile dependency baseline excludes React Navigation packages for dashboard shell

- **WHEN** dependency requirements for `apps/mobile` are reviewed for this capability
- **THEN** `@react-navigation/bottom-tabs`, `@react-navigation/elements`, and `@react-navigation/native` SHALL NOT be required for the dashboard shell behavior

### Requirement: Native Top Navigation Controls for Dashboard Routes

The dashboard route stack SHALL provide native top navigation controls with a settings action on the right and a back action on the left for non-root screens.

#### Scenario: Settings action opens iOS Expo UI SwiftUI bottom sheet

- **WHEN** the app runs on iOS and the user taps the settings action in the top-right header area
- **THEN** the app SHALL open a bottom sheet for settings actions
- **AND** the bottom sheet SHALL be presented using Expo UI SwiftUI `BottomSheet` primitives (`https://docs.expo.dev/versions/latest/sdk/ui/swift-ui/bottomsheet/`)

#### Scenario: Back action appears on pushed routes

- **WHEN** the user navigates from a root dashboard tab route to a deeper route
- **THEN** a back button SHALL appear in the top-left header area
- **AND** activating back SHALL return the user to the previous route

### Requirement: Dashboard Home Starts With Minimal Content

The initial dashboard home content SHALL focus on a single heading before additional recipe modules are introduced.

#### Scenario: Dashboard heading is rendered

- **WHEN** the user lands on the dashboard home tab
- **THEN** the main content area SHALL display the heading text "Your recipes"
- **AND** no additional required content blocks SHALL be necessary for this proposal

### Requirement: Platform-Contemporary Navigation Spacing and Affordances

The dashboard navigation shell SHALL preserve native-feeling spacing and interaction affordances for current iOS and Android conventions.

#### Scenario: iOS navigation feel

- **WHEN** the app runs on iOS
- **THEN** top and bottom navigation spacing, hit targets, and motion SHALL follow native iOS navigation conventions via platform-native components

#### Scenario: Android navigation feel

- **WHEN** the app runs on Android
- **THEN** top and bottom navigation spacing, hit targets, and motion SHALL follow current Material navigation conventions via platform-native components
