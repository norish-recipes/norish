## 1. Dependency and provider setup

- [x] 1.1 Add HeroUI Native RC3 and required peer dependencies to the mobile workspace.
- [x] 1.2 Wire HeroUI provider/bootstrap integration in the Expo app root so HeroUI components can render.
- [x] 1.3 Validate package compatibility and app startup after dependency and provider changes.

## 2. Theme integration

- [x] 2.1 Connect HeroUI theme usage to tokens defined in `tooling/tailwind/native-theme.js`.
- [x] 2.2 Verify HeroUI card styling reads from repository theme values for color, spacing, radius, and typography.

## 3. Start screen card migration

- [x] 3.1 Replace the existing start screen starter panel container with HeroUI `Card` composition.
- [x] 3.2 Preserve existing starter content hierarchy and interaction behavior while migrating to HeroUI card primitives.
- [x] 3.3 Run mobile smoke checks (iOS and Android profiles) to confirm layout and navigation behavior are unchanged.

## 4. Documentation and rollout follow-up

- [x] 4.1 Document HeroUI Native integration pattern for future mobile screen migrations.
- [x] 4.2 Capture any RC3-specific caveats or import conventions discovered during integration.
