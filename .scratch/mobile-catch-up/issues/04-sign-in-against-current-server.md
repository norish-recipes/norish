# 04: Sign in from the app against the current server

**What to build:** A household member enters their server's address, signs in with a password or through Google, GitHub or the household's OIDC provider in the system sign-in sheet, and lands on the smoke screen with their own data. The session survives a relaunch. The server re-accepts the app's sign-in safely. This ticket also sets up the Maestro harness that the later tickets add flows to. See `.scratch/mobile-catch-up/spec.md`, "Server sign-in".

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] `better-auth`, `@better-auth/core` and `@better-auth/expo` are at 1.7.17 in the catalog, and the app uses the same line. The release-age wait is deliberately skipped for this upgrade.
- [ ] The server's auth module mounts the Expo server plugin again.
- [ ] `norish://` is a hard-coded trusted origin in the auth config and is never read from the `TRUSTED_ORIGINS` environment list. `exp://` is trusted only in development.
- [ ] The tRPC WebSocket origin check rejects the opaque `"null"` origin, whatever the configured lists contain.
- [ ] The auth test suite proves that:
  - a sign-in carrying a `norish://` Expo origin is accepted
  - any other custom scheme is rejected
  - `exp://` is rejected outside development
- [ ] The WebSocket server suite proves `"null"` is never trusted, even with a custom scheme in the configured trusted list.
- [ ] The app's auth client uses the `norish` scheme and keeps the session in secure storage. Its tRPC HTTP and WebSocket requests are authenticated with it.
- [ ] A Maestro harness runs locally against the iOS simulator and the dev server, documented in the contributor docs.
- [ ] A Maestro flow signs in through the server-address screen and sees the user and recipe count on the smoke screen.
- [ ] A Maestro flow checks off a grocery on the smoke screen, and the item is checked on the web for the same household.
- [ ] Repeated runs show both flows are stable.
- [ ] The 0.27.0-beta release notes say the server accepts the Norish iOS app's sign-in again.
