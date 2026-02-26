## 1. Implementation

- [ ] 1.1 Create Expo Router tab route structure for the mobile dashboard shell (including a dedicated search tab route) following `https://docs.expo.dev/router/advanced/native-tabs/`.
- [ ] 1.2 Configure Expo native tabs for platform-native behavior, including dedicated Search-tab and minimize-on-scroll behavior per `https://docs.expo.dev/router/advanced/native-tabs/#separate-search-tab` and `https://docs.expo.dev/router/advanced/native-tabs/#tab-bar-minimize-behavior`.
- [ ] 1.3 Add top navigation actions: settings action in the header right and default back behavior in header left for pushed routes.
- [ ] 1.4 Implement settings bottom-sheet presentation flow from the top-right action using project-approved mobile UI primitives.
- [ ] 1.5 Replace starter home content with a minimal dashboard heading that reads "Your recipes".
- [ ] 1.6 Ensure safe-area and spacing behavior remain consistent with existing mobile-ui requirements.

## 2. Validation

- [ ] 2.1 Run `pnpm --filter @norish/mobile run lint` and fix issues.
- [ ] 2.2 Run `pnpm --filter @norish/mobile run typecheck` and fix issues.
- [ ] 2.3 Run `pnpm --filter @norish/mobile run start` and verify: dedicated Search tab, tab-bar minimize-on-scroll behavior, settings sheet opens from top-right action, and back button appears on pushed routes.
