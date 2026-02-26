# Change: Add native recipe dashboard navigation shell for mobile

## Why

The mobile app currently renders a single starter screen and lacks a production navigation shell. We need a native-feeling recipe dashboard foundation that starts with bottom navigation, top navigation controls, and a minimal first content view.

## What Changes

- Add a mobile recipe dashboard navigation shell using Expo Router native tabs for iOS and Android (`https://docs.expo.dev/router/advanced/native-tabs/`).
- Define bottom tab requirements for a dedicated Search tab (`https://docs.expo.dev/router/advanced/native-tabs/#separate-search-tab`) and tab bar minimize-on-scroll behavior (`https://docs.expo.dev/router/advanced/native-tabs/#tab-bar-minimize-behavior`).
- Define top navigation requirements for a settings action (opening a bottom sheet) and stack back navigation on pushed routes.
- Define the first dashboard content requirement as a single heading: "Your recipes".
- Capture platform visual expectations for iOS 26-style and latest Material-style spacing and affordances via native primitives.

## References

- Expo Router Native Tabs: `https://docs.expo.dev/router/advanced/native-tabs/`
- Expo Separate Search Tab: `https://docs.expo.dev/router/advanced/native-tabs/#separate-search-tab`
- Expo Tab Bar Minimize on Scroll: `https://docs.expo.dev/router/advanced/native-tabs/#tab-bar-minimize-behavior`

## Impact

- Affected specs: `mobile-ui`
- Affected code: `apps/mobile/app/**/*`, `apps/mobile/components/**/*`, `apps/mobile/global.css`, mobile navigation/layout wiring
