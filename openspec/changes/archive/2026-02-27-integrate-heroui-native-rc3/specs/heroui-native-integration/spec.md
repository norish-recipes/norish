## ADDED Requirements

### Requirement: HeroUI Native RC3 is configured for the mobile app

The mobile application SHALL install and configure HeroUI Native RC3 with all required runtime and provider setup so HeroUI components render correctly in the Expo app.

#### Scenario: App boots with HeroUI provider

- **WHEN** the mobile app starts in development or production mode
- **THEN** the root app tree SHALL include the HeroUI Native provider configuration required by RC3
- **AND** HeroUI components SHALL render without missing-context or runtime initialization errors

### Requirement: HeroUI uses existing native theme tokens

The integration SHALL consume the existing token definitions from `tooling/tailwind/native-theme.js` as the source for mobile theme styling.

#### Scenario: HeroUI card reflects repository theme tokens

- **WHEN** a HeroUI `Card` is rendered on the start screen
- **THEN** visual tokens (such as spacing, radius, color, and typography) SHALL align with values derived from `tooling/tailwind/native-theme.js`
- **AND** the implementation SHALL NOT introduce a separate conflicting token source for the same concerns
