## Why

The mobile groceries tab is still a placeholder while the web app already supports grouped grocery workflows by store and by recipe. We need an iOS-first UI/UX pass now so the mobile experience can be designed, reviewed, and implemented against a clear product target before wiring real hooks and contexts.

## What Changes

- Add a dedicated mobile groceries capability for the Expo app that defines an iOS-native grocery list experience instead of the current placeholder screen.
- Define store-grouped and recipe-grouped presentation modes that mirror the web app's core organization model while allowing a stronger native mobile visual treatment.
- Define drag-and-drop interactions for reordering and moving grocery items and groups using `react-native-reanimated-dnd`.
- Define a UI-only implementation phase that uses dummy data and does not yet connect shared grocery hooks, contexts, or mutations.
- Define the preferred component layer around `heroui-native` and Expo UI so the experience uses native-feeling controls and Liquid Glass-friendly surfaces where appropriate.

## Capabilities

### New Capabilities
- `mobile-groceries-ui`: iOS-first grocery tab experience with store and recipe grouping modes, mock-data rendering, and native-feeling drag-and-drop interactions.

### Modified Capabilities

## Impact

- Affected code: `apps/mobile/src/app/(tabs)/groceries`, new mobile grocery UI components, route layout/header configuration, and supporting mock-data utilities.
- Dependencies: `heroui-native`, Expo UI native components, and `react-native-reanimated-dnd` for drag-and-drop behavior.
- Product impact: creates the implementation contract for the first real mobile groceries surface without requiring backend wiring in the initial phase.
