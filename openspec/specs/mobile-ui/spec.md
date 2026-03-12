# mobile-ui Specification

## Purpose

TBD - created by archiving change fix-mobile-bugs-and-import-reliability. Update Purpose after archive.

## Requirements

### Requirement: Safe-Area-Top Offset

The app layout SHALL account for device safe areas to prevent content from overlapping with system UI elements like the iOS Dynamic Island or notch.

#### Scenario: App layout on notched device

- **WHEN** the app is viewed on a device with a notch or Dynamic Island
- **THEN** the main content area SHALL have top padding that includes `env(safe-area-inset-top)`
- **AND** content SHALL NOT overlap with the device's safe area

#### Scenario: App layout on non-notched device

- **WHEN** the app is viewed on a device without a notch
- **THEN** the layout SHALL gracefully fall back to standard padding
- **AND** `env(safe-area-inset-top)` SHALL return 0px

### Requirement: Image Lightbox Safe-Area Positioning

The image lightbox close button and navigation elements SHALL respect device safe areas.

#### Scenario: Close button on notched device

- **WHEN** the image lightbox is opened on a device with a notch
- **THEN** the close button SHALL be positioned below the safe area inset
- **AND** the close button SHALL be fully accessible and not obscured by system UI

#### Scenario: Image counter on notched device

- **WHEN** the image lightbox displays multiple images on a notched device
- **THEN** the image counter SHALL be positioned below the safe area inset

### Requirement: Remove Keyboard Offset Hook

The Panel component SHALL NOT use the unreliable `useKeyboardOffset` hook and SHALL rely on `dvh` units for keyboard-aware sizing.

#### Scenario: Panel with keyboard open

- **WHEN** the virtual keyboard is open on mobile
- **THEN** the Panel SHALL automatically adjust its height using `dvh` units
- **AND** the Panel SHALL NOT use JavaScript-based keyboard offset calculations

### Requirement: Mobile shell navigation is product-focused

The mobile UI capability SHALL present navigation that prioritizes product destinations and excludes starter-template walkthrough content.

#### Scenario: Tab/navigation model excludes starter walkthrough surfaces

- **WHEN** the root mobile shell is rendered
- **THEN** navigation controls SHALL reference only active product routes
- **AND** starter-template labels, doc links, and walkthrough entries SHALL NOT be shown

### Requirement: Home recipe cards follow native mobile presentation

The mobile UI capability SHALL provide a native-feeling home recipe card presentation that mirrors the web dashboard information hierarchy while using mobile-first layout and interaction patterns.

#### Scenario: Mobile adaptation of web recipe hierarchy

- **WHEN** the home recipe cards are rendered on mobile
- **THEN** the card content order SHALL prioritize image, title, and description before secondary metadata
- **AND** spacing, typography, and touch targets SHALL be optimized for handheld use

#### Scenario: Modern native metadata grouping

- **WHEN** users scan a recipe card
- **THEN** utility metadata (servings, duration, rating, liked state) SHALL be grouped into compact, readable rows
- **AND** tags and course SHALL be presented as visually distinct, compact labels

### Requirement: Home recipe cards favor design-system primitives over custom styling

The mobile home recipe card UI SHALL use HeroUI Native components and Tailwind utilities as the default styling approach, with custom style overrides limited to cases where no suitable design-system primitive exists.

#### Scenario: Standard card styling implementation

- **WHEN** implementing home recipe cards and list layout
- **THEN** the UI SHALL compose HeroUI Native primitives and Tailwind utility classes for spacing, typography, and surfaces
- **AND** implementation SHALL NOT introduce unnecessary bespoke styling abstractions

#### Scenario: Necessary custom override

- **WHEN** a required presentation detail cannot be expressed with existing HeroUI Native primitives or Tailwind utilities
- **THEN** a minimal custom style override MAY be added
- **AND** the override SHALL be scoped to the smallest surface needed

### Requirement: Mobile language selector uses enabled locale configuration

Mobile language selection UI SHALL source locale options from server-enabled locale configuration and SHALL keep the selected locale aligned with available options.

#### Scenario: Selector renders server-enabled locales only

- **WHEN** the mobile language selector is rendered after locale config is loaded
- **THEN** the selector SHALL list only locales included in `enabledLocales`
- **AND** disabled or unknown locale codes SHALL NOT be shown

#### Scenario: Selected locale is no longer enabled

- **WHEN** the current locale is not present in the latest enabled locale list
- **THEN** the UI SHALL switch selection to a deterministic fallback locale
- **AND** the rendered label SHALL match the fallback locale name/code

### Requirement: Mobile language selector labels are translation-aware

Mobile language selection UI SHALL use i18n translations for selector text while still showing locale display names for options.

#### Scenario: Selector chrome is translated

- **WHEN** mobile renders language selector controls in a given locale
- **THEN** selector titles, helper text, and action labels SHALL resolve from translation keys
- **AND** untranslated keys SHALL fall back using existing i18n fallback behavior

### Requirement: Mobile action affordances are permission and settings aware

Mobile UI surfaces that expose AI actions or delete actions SHALL render those affordances only when the current permission/server-settings contract allows the action.

#### Scenario: AI is disabled

- **WHEN** mobile resolves permission/server-settings state indicating AI features are disabled
- **THEN** AI action buttons SHALL NOT be rendered on affected surfaces
- **AND** users SHALL NOT be able to trigger AI flows from those surfaces

#### Scenario: Delete permission is denied

- **WHEN** mobile resolves permissions indicating delete is not allowed for the current user or resource
- **THEN** delete action buttons SHALL NOT be rendered for that surface
- **AND** delete interactions SHALL NOT be reachable through visible controls

#### Scenario: Permission state is loading or unknown

- **WHEN** mobile has not yet resolved permission/server-settings state
- **THEN** restricted AI and delete affordances SHALL default to hidden
- **AND** visibility SHALL update once permission/server-settings state resolves
