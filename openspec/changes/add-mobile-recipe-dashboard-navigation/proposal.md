# Change: Add native recipe dashboard navigation shell for mobile

## Why

The mobile app currently renders a single starter screen and lacks a production navigation shell. We need a native-feeling recipe dashboard foundation that uses Expo-native navigation and UI primitives, while removing redundant legacy navigation packages from the mobile app baseline.

## What Changes

- Add a mobile recipe dashboard navigation shell using Expo Router native tabs for iOS and Android (`https://docs.expo.dev/router/advanced/native-tabs/`).
- Define bottom tab requirements for a dedicated Search tab (`https://docs.expo.dev/router/advanced/native-tabs/#separate-search-tab`) and tab bar minimize-on-scroll behavior (`https://docs.expo.dev/router/advanced/native-tabs/#tab-bar-minimize-behavior`).
- Define top navigation requirements for a settings action and stack back navigation on pushed routes.
- Define settings sheet behavior to use Expo UI SwiftUI `BottomSheet` on iOS (`https://docs.expo.dev/versions/latest/sdk/ui/swift-ui/bottomsheet/`), not HeroUI bottom sheet primitives.
- Remove old React Navigation packages from `apps/mobile` for this dashboard-shell scope: `@react-navigation/bottom-tabs`, `@react-navigation/elements`, and `@react-navigation/native`.
- Define the first dashboard content requirement as a single heading: "Your recipes".
- Capture platform visual expectations using native primitives, prioritizing Expo UI where available and HeroUI where complementary components are still needed.

## References

- Expo Router Native Tabs: `https://docs.expo.dev/router/advanced/native-tabs/`
- Expo Separate Search Tab: `https://docs.expo.dev/router/advanced/native-tabs/#separate-search-tab`
- Expo Tab Bar Minimize on Scroll: `https://docs.expo.dev/router/advanced/native-tabs/#tab-bar-minimize-behavior`
- Expo UI SwiftUI: `https://docs.expo.dev/versions/latest/sdk/ui/swift-ui/`
- Expo UI SwiftUI BottomSheet: `https://docs.expo.dev/versions/latest/sdk/ui/swift-ui/bottomsheet/`

## Impact

- Affected specs: `mobile-ui`
- Affected code: `apps/mobile/app/**/*`, `apps/mobile/components/**/*`, `apps/mobile/package.json`, `apps/mobile/global.css`, mobile navigation/layout wiring
