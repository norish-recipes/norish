## Why

The mobile Expo starter currently uses baseline UI primitives, which slows down consistent UI development and makes it harder to leverage a shared design system. Adopting HeroUI Native RC3 now aligns the app with a modern component library and allows the existing Tailwind native theme to drive component styling.

## What Changes

- Add HeroUI Native RC3 to the mobile workspace and configure required provider/setup for the Expo app entry point.
- Integrate HeroUI Native with the existing Tailwind native theme at `tooling/tailwind/native-theme.js` so design tokens remain the source of truth.
- Replace the current start screen card with a HeroUI `Card` implementation while preserving existing content intent and navigation behavior.
- Document integration and migration notes for future screen-level adoption of HeroUI components.

## Capabilities

### New Capabilities

- `heroui-native-integration`: Adds a standardized HeroUI Native setup for the mobile app, including provider wiring, theme token alignment, and baseline component usage patterns.

### Modified Capabilities

- `mobile-ui`: Updates starter screen UI requirements to use HeroUI Native Card primitives instead of ad hoc card styling.

## Impact

- Affected code: mobile Expo app entry/provider setup, start screen component(s), and UI layer dependencies.
- Dependencies: add HeroUI Native RC3 package(s) and any required peer/runtime packages.
- Styling/theming: consume and validate existing tokens from `tooling/tailwind/native-theme.js`.
- Developer workflow: establish the default pattern for future mobile UI composition using HeroUI components.
