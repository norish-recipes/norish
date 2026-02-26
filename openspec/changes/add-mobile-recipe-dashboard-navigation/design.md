## Context

`apps/mobile` is currently configured with HeroUI Native providers and theme tokens, but it still uses a single-route starter experience. This proposal introduces a dashboard-oriented mobile navigation shell built on Expo Router native tabs, with a native top bar pattern and a minimal main content target.

## Goals / Non-Goals

- Goals:
  - Establish bottom navigation using Expo native tabs with a dedicated Search tab.
  - Support tab bar minimize behavior on scroll for content-first mobile ergonomics.
  - Add top navigation controls: settings action (top-right) and back affordance on pushed routes (top-left).
  - Render a minimal dashboard home content area with the heading "Your recipes".
  - Keep visual behavior aligned with contemporary iOS and Android platform conventions by using native navigation primitives and spacing defaults.
- Non-Goals:
  - Building full recipe list cards, filters, or search result experiences.
  - Implementing full settings form content beyond opening the sheet.
  - Defining a custom cross-platform design language that overrides platform-native navigation behavior.

## Decisions

- Decision: Use Expo Router native tabs for bottom navigation rather than custom tab UI.
  - Why: Native tabs provide platform-correct behavior and support dedicated search tab and minimize-on-scroll capabilities directly (`https://docs.expo.dev/router/advanced/native-tabs/`, `https://docs.expo.dev/router/advanced/native-tabs/#separate-search-tab`, `https://docs.expo.dev/router/advanced/native-tabs/#tab-bar-minimize-behavior`).
- Decision: Keep top navigation in stack headers, with header actions defined per route group.
  - Why: Stack headers naturally support back behavior and platform-native title/action layout.
- Decision: Present settings as a bottom sheet surfaced from the top-right settings action.
  - Why: This preserves task focus while matching modern mobile interaction patterns for lightweight settings access.
- Decision: Start dashboard content with a single heading requirement only.
  - Why: Keeps scope tightly aligned with the requested first increment.

## Alternatives Considered

- Build a custom bottom tab bar and custom top bar from view primitives.
  - Rejected: higher implementation complexity and greater risk of drifting from platform-native behavior.
- Use JavaScript-based tab navigators instead of Expo native tabs.
  - Rejected: misses the explicit requirement to use Expo native tabs and can diverge from expected native UX details.
- Place settings on a standalone tab instead of top-right action.
  - Rejected: conflicts with requested top nav behavior and unnecessarily consumes a primary tab slot.

## Risks / Trade-offs

- HeroUI Native bottom-sheet API differences may require adapter work versus direct usage.
  - Mitigation: keep spec focused on behavior (sheet opens from settings action), not a rigid component import path.
- Minimize-on-scroll depends on correct scroll container setup per screen.
  - Mitigation: include implementation task and validation for scroll-linked behavior on dashboard screens.

## Migration Plan

1. Introduce tab-based route structure and native tab configuration.
2. Add top header actions and route-level back behavior.
3. Add settings sheet trigger plumbing.
4. Replace starter screen body with "Your recipes" heading.
5. Validate behavior on iOS and Android simulators/devices.

## Open Questions

- None required for proposal approval; implementation can proceed with platform-native defaults and refine visuals in follow-up changes if needed.

## References

- Expo Router Native Tabs: `https://docs.expo.dev/router/advanced/native-tabs/`
- Expo Separate Search Tab: `https://docs.expo.dev/router/advanced/native-tabs/#separate-search-tab`
- Expo Tab Bar Minimize on Scroll: `https://docs.expo.dev/router/advanced/native-tabs/#tab-bar-minimize-behavior`
