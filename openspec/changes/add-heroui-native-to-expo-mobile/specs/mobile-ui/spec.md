## ADDED Requirements

### Requirement: HeroUI Native Foundation for Mobile App

The `apps/mobile` Expo application SHALL initialize HeroUI Native according to its required runtime setup, including provider composition and mandatory peer dependency compatibility.

#### Scenario: App bootstraps with HeroUI Native providers

- **WHEN** the mobile app root layout renders
- **THEN** the app SHALL wrap route content in `GestureHandlerRootView`
- **AND** the app SHALL provide `HeroUINativeProvider` at the root so HeroUI Native components can render

#### Scenario: Dependency baseline is present

- **WHEN** dependencies are installed for `@norish/mobile`
- **THEN** `heroui-native` and its mandatory peer libraries SHALL be declared in `apps/mobile/package.json`
- **AND** versions SHALL follow HeroUI Native quick-start compatibility guidance or verified compatible equivalents

### Requirement: Mobile Theme Tokens Reuse Shared Hero Theme

The mobile app SHALL consume semantic UI tokens from the shared `tooling/tailwind` theme assets rather than defining an app-local duplicate theme.

#### Scenario: Global styles import shared native theme adapter

- **WHEN** mobile global styles are evaluated
- **THEN** they SHALL import `@norish/tailwind-config/native-theme`
- **AND** the imported adapter SHALL resolve to token values derived from `tooling/tailwind/theme.css`

#### Scenario: Missing native semantic variables are bridged in tooling

- **WHEN** HeroUI Native expects semantic variables not provided directly by existing Norish token names
- **THEN** the mapping SHALL be added in `tooling/tailwind/native-theme.css`
- **AND** the mapping SHALL reference existing Norish token variables instead of introducing unrelated palettes

### Requirement: Starter UI Uses HeroUI Native Components

The default Expo starter UI SHALL be replaced with a minimal Norish starter screen that demonstrates HeroUI Native component rendering with semantic theme classes.

#### Scenario: Starter screen renders HeroUI Native primitives

- **WHEN** a user opens the initial mobile route
- **THEN** the screen SHALL include at least one HeroUI Native interactive component
- **AND** the screen SHALL apply semantic token classes for background and foreground presentation

#### Scenario: Template-specific starter artifacts are removed

- **WHEN** integration is complete
- **THEN** unused Expo template starter screens/components SHALL be removed or no longer referenced by active routes
- **AND** mobile navigation SHALL remain functional after cleanup
