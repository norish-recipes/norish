# mobile-native-tabs-navigation Specification

## Purpose

Defines requirements for the mobile shell's native bottom tab navigation, including tab destinations, native search tab behavior, and minimize-on-scroll tab bar behavior.

## Requirements

### Requirement: Product-focused bottom tab destinations

The mobile shell SHALL render a native bottom tab menu with exactly four product destinations in this order: Recipes, Groceries, Calendar, and Profile.

#### Scenario: Bottom tabs render expected destinations

- **WHEN** an authenticated user opens the mobile app shell
- **THEN** the bottom tab menu displays Recipes, Groceries, Calendar, and Profile
- **AND** the tabs navigate to their corresponding destination routes

#### Scenario: Navigation excludes non-product starter entries

- **WHEN** the shell tab model is built
- **THEN** non-product starter-template or walkthrough entries are not included in the bottom tab menu

### Requirement: Native search tab behavior is enabled

The mobile shell SHALL surface search from the Recipes (home) tab using a `bottomAccessory` search bar component, not from a dedicated search tab trigger in the tab bar. The search entry point SHALL be accessible as a tappable search bar rendered via `bottomAccessory` on the Recipes tab.

#### Scenario: Search entrypoint appears as bottom accessory on home tab

- **WHEN** the native tab bar is rendered with the Recipes tab active
- **THEN** a search bar is visible as a bottom accessory (above or inline with the tab bar depending on minimize state)
- **AND** no dedicated search tab icon slot is present in the tab bar

#### Scenario: Search entrypoint routes to search experience

- **WHEN** the user taps the search bar in the bottom accessory
- **THEN** the app navigates to the search screen without replacing the four core destination tabs in the tab bar

### Requirement: Profile tab uses a custom profile icon

The Profile tab in the native bottom tab bar SHALL display a custom icon that visually communicates account/profile ownership, using SF Symbol `person.crop.circle` (filled variant when selected) on iOS and an equivalent icon on Android.

#### Scenario: Profile tab icon is displayed in the tab bar

- **WHEN** the native tab bar is rendered
- **THEN** the Profile tab displays the `person.crop.circle` SF Symbol on iOS (or equivalent icon on Android)

#### Scenario: Profile tab icon changes to filled variant when selected

- **WHEN** the user navigates to the Profile tab
- **THEN** the Profile tab icon changes to the filled variant (`person.crop.circle.fill`) on iOS to indicate the active state

### Requirement: Tab bar minimizes on scroll

The mobile shell SHALL enable native-tabs minimize-on-scroll behavior for eligible scrollable tab screens so navigation chrome reduces while users browse content.

#### Scenario: Tab bar minimizes while scrolling content

- **WHEN** the user scrolls downward in a tab screen that supports minimize-on-scroll
- **THEN** the tab bar minimizes according to native-tabs behavior

#### Scenario: Tab bar returns when navigation context is needed

- **WHEN** the user scrolls upward or stops scrolling
- **THEN** the tab bar reappears per native-tabs platform behavior
