# 03: App identity

**What to build:** The app looks like Norish instead of the Expo template. It installs as Norish with Norish's own icon and splash, draws in Norish's typefaces, and is built for iPhone. The native identity is set once, on the new SDK. See `.scratch/mobile-catch-up/spec.md`.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] The bundle id is `dev.norish.app`, the URL scheme is `norish`, and the slug and display name follow.
- [ ] `supportsTablet` is off; iPad and foldable support come in their own pass after the iPhone redesign.
- [ ] The app icon, adaptive colours and splash come from the brand set the web ships, on the paper ground with the green accent. No Expo template colour or asset remains, and the template assets are deleted.
- [ ] Inter, Fraunces and Fira Code are loaded before first render, so the shared theme's sans, serif and mono font tokens resolve. The smoke screen and sign-in screens draw in Inter.
- [ ] The app builds and launches in the iOS simulator on iPhone.
