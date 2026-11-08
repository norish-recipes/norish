# 03: App identity

**What to build:** The app looks like Norish instead of the Expo template. It installs as Norish with Norish's own icon and splash, draws in Norish's typefaces, and is built for iPhone. The native identity is set once, on the new SDK. See `.scratch/mobile-catch-up/spec.md`.

**Blocked by:** 02

**Status:** ready-for-agent

- [x] The bundle id is `dev.norish.app`, the URL scheme is `norish`, and the slug and display name follow.
- [x] `supportsTablet` is off; iPad and foldable support come in their own pass after the iPhone redesign.
- [x] The app icon, adaptive colours and splash come from the brand set the web ships, on the paper ground with the green accent. No Expo template colour or asset remains, and the template assets are deleted.
- [x] Inter, Fraunces and Fira Code are loaded before first render, so the shared theme's sans, serif and mono font tokens resolve. The smoke screen and sign-in screens draw in Inter.
- [x] The app builds and launches in the iOS simulator on iPhone.

## Comments

- 2026-11-05 — Done apart from the simulator launch, which is blocked on Xcode 27 like ticket 02 (`expo-modules-jsi` 58 does not compile with Xcode 26.3). Checked instead: `expo prebuild -p ios` writes bundle id `dev.norish.app`, display name Norish, URL scheme `norish`, `TARGETED_DEVICE_FAMILY = 1`, the 1024 icon and the light/dark splash (paper `#F8F3E7` / `#14110D` with the wordmark, as the web splash draws it); `expo export -p ios` bundles the six font files and resolves `font-sans`, `font-serif`, `font-mono` and the four weight utilities to Inter, Fraunces and Fira Code faces. The PNGs under `assets/brand/` are rendered from the web's `public/brand/favicon.svg` and `public/logo.svg`. The better-auth Expo client now uses the `norish` scheme too; the server's trusted `norish://` origin is ticket 04's.
- 2026-11-08 — Builds and launches on the iPhone 17 simulator with Xcode 27.2, as Norish, in Inter. The heroui-native accent and ground are still its default blue and grey: the shared `heroui-theme.css` writes its tokens under `:root, .light, [data-theme]` selectors, and Uniwind only reads `@variant light`/`@variant dark` blocks, so the spec's "colours come from the shared theme" holds on web only. This predates the catch-up; it is raised for the redesign rather than fixed here.
- 2026-11-08 — The theme now reaches the app, in light and dark (checked on the simulator). Uniwind reads a theme's tokens only from `:where(.light)`/`:where(.dark)`, and a bare `.light` before them filed them as a class's styles instead, so the shared file adds the `:where()` forms and writes its classes as `:is(.light)`/`:is(.dark)`, which match the same elements at the same specificity on web. The navigator also painted React Navigation's stock grey and black behind every screen; `_layout.tsx` now builds its theme from the shared colours.
