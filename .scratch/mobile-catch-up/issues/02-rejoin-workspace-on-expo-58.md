# 02: Rejoin the workspace on Expo 58

**What to build:** The app stops being parked. It goes back into the pnpm workspace on the shared catalog, moves from Expo SDK 56 to SDK 58, and is reached by the root gates, so a shared change that breaks it turns CI red. A contributor installs everything with the one root install and starts the app with `pnpm dev:mobile`; it boots in the iOS simulator to the server-address screen. See `.scratch/mobile-catch-up/spec.md`.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] The workspace no longer excludes the app, its own lockfile is deleted, and its dependencies use `catalog:` and `workspace:*` wherever the catalog has the package.
- [ ] Expo is on SDK 58 (npm `latest`), with React Native and the Expo modules at the versions SDK 58 pins.
- [ ] React resolves to one version across the workspace, or the app's divergence from the catalog is a documented override with the reason given. SDK 58 pins React 19.3.0 and the catalog has 19.3.1.
- [ ] heroui-native and uniwind are on versions that support SDK 58. If none exists, the ticket stops and reports back instead of forking a workaround.
- [ ] The app has `typecheck`, `lint` and `test` scripts, and `pnpm typecheck`, `pnpm lint` and `pnpm test:run` from the root cover it and pass.
- [ ] The remaining mobile vitest files pass. Files that test only deleted or soon-replaced code are deleted, not skipped.
- [ ] The root `dev:mobile` script goes back to a workspace filter.
- [ ] The version-sync tooling stops treating the app as independent, so the app version follows the release version.
- [ ] The cycle check no longer special-cases the app.
- [ ] AGENTS.md and CONTRIBUTING no longer call the app parked or describe a separate install.
- [ ] The app boots in the iOS simulator to the server-address screen.
