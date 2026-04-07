## ADDED Requirements

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
