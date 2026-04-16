## ADDED Requirements

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

The mobile shell SHALL configure Expo Router native-tabs search behavior so users can open a dedicated native search experience from the tab bar.

#### Scenario: Search entrypoint appears in tab UI

- **WHEN** the native tab bar is rendered
- **THEN** a dedicated search tab entrypoint is available using native-tabs search configuration

#### Scenario: Search entrypoint routes to search experience

- **WHEN** the user activates the search tab entrypoint
- **THEN** the app opens the configured search experience without replacing the four core destination tabs

### Requirement: Tab bar minimizes on scroll

The mobile shell SHALL enable native-tabs minimize-on-scroll behavior for eligible scrollable tab screens so navigation chrome reduces while users browse content.

#### Scenario: Tab bar minimizes while scrolling content

- **WHEN** the user scrolls downward in a tab screen that supports minimize-on-scroll
- **THEN** the tab bar minimizes according to native-tabs behavior

#### Scenario: Tab bar returns when navigation context is needed

- **WHEN** the user scrolls upward or stops scrolling
- **THEN** the tab bar reappears per native-tabs platform behavior
