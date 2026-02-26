## 1. Implementation

- [x] 1.1 Create Expo Router tab route structure for the mobile dashboard shell (including a dedicated search tab route) following `https://docs.expo.dev/router/advanced/native-tabs/`.
- [x] 1.2 Configure Expo native tabs for platform-native behavior, including dedicated Search-tab and minimize-on-scroll behavior per `https://docs.expo.dev/router/advanced/native-tabs/#separate-search-tab` and `https://docs.expo.dev/router/advanced/native-tabs/#tab-bar-minimize-behavior`.
- [x] 1.3 Remove old React Navigation package dependencies from `apps/mobile` for this shell: `@react-navigation/bottom-tabs`, `@react-navigation/elements`, and `@react-navigation/native`.
- [x] 1.4 Add top navigation actions: settings action in the header right and default back behavior in header left for pushed routes.
- [x] 1.5 Implement iOS settings bottom-sheet presentation flow from the top-right action using Expo UI SwiftUI `BottomSheet` (`@expo/ui/swift-ui`).
- [x] 1.6 Replace starter home content with a minimal dashboard heading that reads "Your recipes".
- [x] 1.7 Ensure safe-area and spacing behavior remain consistent with existing mobile-ui requirements.

## 2. Validation

- [x] 2.1 Run `pnpm --filter @norish/mobile run lint` and fix issues.
- [x] 2.2 Run `pnpm --filter @norish/mobile run typecheck` and fix issues.
- [ ] 2.3 Verify iOS behavior in a development build: dedicated Search tab, tab-bar minimize-on-scroll behavior, settings sheet opens from top-right action via Expo UI SwiftUI BottomSheet, and back button appears on pushed routes.
- [ ] 2.4 Verify Android baseline behavior: native tab navigation and header/back behavior function without regressions (settings-sheet parity not required in this change).
