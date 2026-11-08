# 02: Rejoin the workspace on Expo 58

**What to build:** The app stops being parked. It goes back into the pnpm workspace on the shared catalog, moves from Expo SDK 56 to SDK 58, and is reached by the root gates, so a shared change that breaks it turns CI red. A contributor installs everything with the one root install and starts the app with `pnpm dev:mobile`; it boots in the iOS simulator to the server-address screen. See `.scratch/mobile-catch-up/spec.md`.

**Blocked by:** 01

**Status:** ready-for-agent

- [x] The workspace no longer excludes the app, its own lockfile is deleted, and its dependencies use `catalog:` and `workspace:*` wherever the catalog has the package.
- [x] Expo is on SDK 58 (npm `latest`), with React Native and the Expo modules at the versions SDK 58 pins.
- [x] React resolves to one version across the workspace, or the app's divergence from the catalog is a documented override with the reason given. SDK 58 pins React 19.3.0 and the catalog has 19.3.1.
- [x] heroui-native and uniwind are on versions that support SDK 58. If none exists, the ticket stops and reports back instead of forking a workaround.
- [x] The app has `typecheck`, `lint` and `test` scripts, and `pnpm typecheck`, `pnpm lint` and `pnpm test:run` from the root cover it and pass.
- [x] The remaining mobile vitest files pass. Files that test only deleted or soon-replaced code are deleted, not skipped.
- [x] The root `dev:mobile` script goes back to a workspace filter.
- [x] The version-sync tooling stops treating the app as independent, so the app version follows the release version.
- [x] The cycle check no longer special-cases the app.
- [x] AGENTS.md and CONTRIBUTING no longer call the app parked or describe a separate install.
- [x] The app boots in the iOS simulator to the server-address screen.

## Comments

- 2026-11-05 — Done apart from the simulator boot. React stays one version, the catalog's 19.3.1: React Native 0.88.1 peers `react ^19.3.0` and its renderer has no exact-version check, so `expo.install.exclude` lists `react` and `expo-doctor` passes. The app lints with the shared `@norish/eslint-config` now, which flagged seven `finally` blocks the React Compiler skips; they were flattened. `@norish/trpc` types come from `dist/`, like web and shared-react. The two stale provider options (`onWebSocketClientDestroy`, `invalidateOnReconnect`) had to go for the type check, which ticks ticket 05's third box. The Release simulator build fails on this Mac: Xcode 26.3 (Swift 6.2.4) cannot compile `expo-modules-jsi` 58.0.22 (`JavaScriptObject.swift:946: sending 'slot' risks causing data races`), which SDK 58 builds with Xcode 27. `expo export -p ios` bundles the app, so the boot is unchecked until Xcode 27 is installed.
- 2026-11-08 — Xcode 27.2 builds it: `expo-modules-jsi` compiles, and a Release build boots on the iPhone 17 simulator (iOS 26.2) to the server-address screen. The first Xcode build failed in bundling: `src/global.css` imports `tailwindcss`, which `uniwind` peers but the app never declared, so it did not resolve from `apps/mobile` once Metro's cache was cold. `expo export -p ios` had passed on a warm cache. The app now declares `tailwindcss` from the catalog.
