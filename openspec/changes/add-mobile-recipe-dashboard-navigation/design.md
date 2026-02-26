## Context

`apps/mobile` is currently configured with HeroUI Native providers and theme tokens, but it still uses a single-route starter experience. The current dependency set also includes multiple `@react-navigation/*` packages that are not required for an Expo Router native-tabs-first dashboard shell. This proposal introduces a dashboard-oriented mobile navigation shell built on Expo Router native tabs, with iOS-native sheet presentation using Expo UI SwiftUI BottomSheet and a minimal main content target.

## Goals / Non-Goals

- Goals:
  - Establish bottom navigation using Expo native tabs with a dedicated Search tab.
  - Support tab bar minimize behavior on scroll for content-first mobile ergonomics.
  - Add top navigation controls: settings action (top-right) and back affordance on pushed routes (top-left).
  - Present settings with Expo UI SwiftUI BottomSheet on iOS.
  - Remove `@react-navigation/*` dependency requirements for this mobile dashboard shell.
  - Render a minimal dashboard home content area with the heading "Your recipes".
  - Keep visual behavior aligned with contemporary iOS and Android platform conventions by using native navigation primitives and Expo UI where available.
- Non-Goals:
  - Building full recipe list cards, filters, or search result experiences.
  - Implementing full settings form content beyond opening the sheet.
  - Defining Android settings-sheet parity in this change (iOS-only sheet scope for now).

## Decisions

- Decision: Use Expo Router native tabs for bottom navigation rather than custom tab UI.
  - Why: Native tabs provide platform-correct behavior and support dedicated search tab and minimize-on-scroll capabilities directly (`https://docs.expo.dev/router/advanced/native-tabs/`, `https://docs.expo.dev/router/advanced/native-tabs/#separate-search-tab`, `https://docs.expo.dev/router/advanced/native-tabs/#tab-bar-minimize-behavior`).
- Decision: Keep top navigation in stack headers, with header actions defined per route group.
  - Why: Stack headers naturally support back behavior and platform-native title/action layout.
- Decision: Present settings as Expo UI SwiftUI BottomSheet on iOS only.
  - Why: Matches the requirement to prioritize Expo native UI primitives and aligns with current platform support (`iOS`, `tvOS`) (`https://docs.expo.dev/versions/latest/sdk/ui/swift-ui/bottomsheet/`).
- Decision: Remove `@react-navigation/*` dependency requirements from the mobile app for this shell.
  - Why: Avoids overlapping navigation stacks and keeps the navigation foundation centered on Expo Router + native tabs.
- Decision: Start dashboard content with a single heading requirement only.
  - Why: Keeps scope tightly aligned with the requested first increment.

## Alternatives Considered

- Build a custom bottom tab bar and custom top bar from view primitives.
  - Rejected: higher implementation complexity and greater risk of drifting from platform-native behavior.
- Use JavaScript-based tab navigators instead of Expo native tabs.
  - Rejected: misses the explicit requirement to use Expo native tabs and can diverge from expected native UX details.
- Use HeroUI-based sheet primitives for settings.
  - Rejected: requirement is to use Expo UI native elements for this sheet behavior.
- Keep `@react-navigation/*` as an additional navigation layer.
  - Rejected: unnecessary overlap and maintenance burden for this scope.

## Risks / Trade-offs

- Expo UI SwiftUI is beta and requires development builds.
  - Mitigation: capture this in validation tasks and verify iOS behavior in a development build.
- iOS-only settings-sheet scope leaves Android parity deferred.
  - Mitigation: track Android sheet behavior in a future follow-up change.
- Minimize-on-scroll depends on correct scroll container setup per screen.
  - Mitigation: include implementation task and validation for scroll-linked behavior on dashboard screens.

## Migration Plan

1. Introduce tab-based route structure and native tab configuration.
2. Remove `@react-navigation/*` dependency usage/requirements from the mobile shell baseline.
3. Add top header actions and route-level back behavior.
4. Add iOS settings sheet trigger plumbing using Expo UI SwiftUI BottomSheet.
5. Replace starter screen body with "Your recipes" heading.
6. Validate behavior on iOS (required) and Android baseline navigation (without sheet parity requirement).

## Open Questions

- None required for proposal approval; Android settings-sheet behavior is intentionally deferred.

## References

- Expo Router Native Tabs: `https://docs.expo.dev/router/advanced/native-tabs/`
- Expo Separate Search Tab: `https://docs.expo.dev/router/advanced/native-tabs/#separate-search-tab`
- Expo Tab Bar Minimize on Scroll: `https://docs.expo.dev/router/advanced/native-tabs/#tab-bar-minimize-behavior`
- Expo UI SwiftUI: `https://docs.expo.dev/versions/latest/sdk/ui/swift-ui/`
- Expo UI SwiftUI BottomSheet: `https://docs.expo.dev/versions/latest/sdk/ui/swift-ui/bottomsheet/`
