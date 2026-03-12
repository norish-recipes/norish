## Why

The app currently uses `expo-router/unstable-native-tabs` for tab navigation, which wraps `@react-navigation/bottom-tabs` but exposes a limited subset of its capabilities. Migrating directly to `createNativeBottomTabNavigator` from `@react-navigation/bottom-tabs/unstable` unlocks first-class access to `bottomAccessory` (an inline search bar on the home screen), `tabBarMinimizeBehavior` (minimize on scroll), and the ability to render a custom profile button in the tab bar — none of which are currently configurable through the Expo Router abstraction.

## What Changes

- **Replace** `expo-router/unstable-native-tabs` `NativeTabs` with `createNativeBottomTabNavigator` from `@react-navigation/bottom-tabs/unstable`
- **Add** `tabBarMinimizeBehavior: "onScrollDown"` at the navigator level so the tab bar minimizes as users scroll content
- **Add** `bottomAccessory` to the Recipes (home) screen that renders a native search bar inline with the minimized tab bar and above the tab bar when expanded
- **Add** a custom profile button on the right side of the tab bar — using `tabBarIcon` with a custom image or SF Symbol for the profile tab
- **Remove** the Expo Router `NativeTabs` abstraction from `(tabs)/_layout.tsx` in favor of a direct React Navigation navigator
- Keep the same four tab destinations: Recipes, Groceries, Calendar, Profile (in that order)
- Keep the search experience routed to the existing `/search` screen, now triggered from the `bottomAccessory` search bar rather than a dedicated search tab trigger

## Capabilities

### New Capabilities

- `bottom-tab-search-accessory`: A search bar rendered as a `bottomAccessory` on the Recipes (home) tab — visible inline with the collapsed tab bar when minimized, and above the tab bar when expanded. Activating it navigates to the search screen.

### Modified Capabilities

- `mobile-native-tabs-navigation`: Search entry point changes from a `NativeTabs.Trigger` with `role="search"` to a `bottomAccessory` search bar component. Minimize-on-scroll behavior is preserved. Profile tab gains a custom icon. Tab bar structure (four core destinations) is preserved.

## Impact

- `apps/mobile/src/app/(tabs)/_layout.tsx` — primary file replaced: swaps `NativeTabs` for `createNativeBottomTabNavigator`
- `apps/mobile/package.json` — `@react-navigation/bottom-tabs` already present (`^7.7.3`); importing from `@react-navigation/bottom-tabs/unstable` sub-path requires no new package, but Expo SDK 53+ / React Native 0.79+ and latest `react-native-screens` are required
- Expo Router file-based routing continues to define the actual screen files; only the tab bar shell and navigator wrapper change
- The search tab trigger (`NativeTabs.Trigger name="search" role="search"`) is removed; search is surfaced via `bottomAccessory` instead
- `openspec/specs/mobile-native-tabs-navigation/spec.md` — requirements for the search entry point and minimize-on-scroll will be updated to reflect the new approach
