# Change: Add mobile recipe dashboard grid cards with native menu

## Why

The Expo mobile app currently shows a HeroUI showcase card, but it does not reflect the recipe browsing experience users already have on the Norish web dashboard. Recreating the dashboard-style recipe cards in the mobile package with a device-native action menu gives mobile users a familiar starting point and unlocks a practical interaction pattern for card actions.

## What Changes

- Replace the mobile starter showcase screen with a recipe dashboard-style grid made of reusable mobile recipe card components.
- Recreate the core card presentation used on the web dashboard (thumbnail-first card, recipe title, summary text, and quick metadata/tags where available).
- Add a basic per-card action menu that uses platform-native menu presentation/styling rather than a custom styled dropdown.
- Keep the scope UI-focused: this change defines card/menu behavior and component contracts without requiring full backend recipe data wiring.

## Impact

- Affected specs: `mobile-ui`
- Affected code: `apps/mobile/app/index.tsx`, new `apps/mobile/components/recipe-dashboard/*` components, and mobile package dependencies if a native menu package is required
