## Why

The mobile app needs a clearer navigation model and quick access to app-level controls so core destinations are easier to reach and preferences are easier to manage. Adding native tabs plus a top-right settings entry aligns the shell with Expo Router native-tabs patterns and improves everyday usability.

## What Changes

- Add a native bottom tab menu with product-focused destinations: Recipes, Groceries, Calendar, and Profile.
- Add native-tabs search support with a dedicated search tab experience.
- Enable native-tabs minimize-on-scroll behavior so the tab bar gets out of the way while reading content.
- Add a top-right cog action in the app shell that opens a HeroUI bottom sheet for app preferences.
- Add an appearance preference in the settings sheet with Light, Dark, and System mode options.

## Capabilities

### New Capabilities

- `mobile-native-tabs-navigation`: Defines the mobile shell tab model, tab destinations, native search tab behavior, and minimize-on-scroll behavior.
- `mobile-theme-settings-sheet`: Defines the shell settings entrypoint and bottom-sheet UX for selecting Light, Dark, or System appearance mode.

### Modified Capabilities

- None.

## Impact

- Affected code: Expo Router app shell and tab layout files, mobile header actions, and settings bottom-sheet components.
- Dependencies/systems: Expo Router advanced native-tabs APIs and HeroUI Native BottomSheet component.
- Data/preferences: app appearance mode preference read/write flow (including default System behavior) must be wired into existing preference state handling.
