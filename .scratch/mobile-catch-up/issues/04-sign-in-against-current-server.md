# 04: Sign in from the app against the current server

**What to build:** A household member enters their server's address, signs in with a password or through Google, GitHub or the household's OIDC provider in the system sign-in sheet, and lands on the smoke screen with their own data. The session survives a relaunch. The server re-accepts the app's sign-in safely. This ticket also sets up the Maestro harness that the later tickets add flows to. See `.scratch/mobile-catch-up/spec.md`, "Server sign-in".

**Blocked by:** 03

**Status:** ready-for-agent

- [x] `better-auth`, `@better-auth/core` and `@better-auth/expo` are at 1.7.17 in the catalog, and the app uses the same line. The release-age wait is deliberately skipped for this upgrade.
- [x] The server's auth module mounts the Expo server plugin again.
- [x] `norish://` is a hard-coded trusted origin in the auth config and is never read from the `TRUSTED_ORIGINS` environment list. `exp://` is trusted only in development.
- [x] The tRPC WebSocket origin check rejects the opaque `"null"` origin, whatever the configured lists contain.
- [x] The auth test suite proves that:
  - a sign-in carrying a `norish://` Expo origin is accepted
  - any other custom scheme is rejected
  - `exp://` is rejected outside development
- [x] The WebSocket server suite proves `"null"` is never trusted, even with a custom scheme in the configured trusted list.
- [x] The app's auth client uses the `norish` scheme and keeps the session in secure storage. Its tRPC HTTP and WebSocket requests are authenticated with it.
- [ ] A Maestro harness runs locally against the iOS simulator and the dev server, documented in the contributor docs.
- [ ] A Maestro flow signs in through the server-address screen and sees the user and recipe count on the smoke screen.
- [ ] A Maestro flow checks off a grocery on the smoke screen, and the item is checked on the web for the same household.
- [ ] Repeated runs show both flows are stable.
- [x] The 0.27.0-beta release notes say the server accepts the Norish iOS app's sign-in again.

## Comments

- 2026-11-05 — Done apart from running the Maestro flows, which is blocked like tickets 02 and 03: SDK 58 needs Xcode 27 to build the app, this Mac has Xcode 26.3, and Maestro is not installed. The flows (`apps/mobile/maestro/sign-in.yaml`, `check-grocery.yaml`), the runner (`pnpm --filter @norish/mobile maestro`, which seeds a disposable `maestro@norish.test` account and one unchecked grocery, then checks the grocery is done on the server) and the CONTRIBUTING section are written but have never run, so the four Maestro boxes stay open.
  - `@better-auth/api-key` moved to 1.7.17 too: it peers `better-auth ^1.7.17`. No release-age exclusion was needed: 1.7.17 was published 2026-11-04 15:53 UTC, past pnpm 12's one-day minimum by install time.
  - Vitest sets `TEST`, which turns Better Auth's origin check off, so the auth-handler suite never checked origins. It now unsets it suite-wide; the existing 25 cases pass unchanged.
  - The WebSocket check now treats any opaque origin as unparseable, on both sides: a `norish://` entry in `TRUSTED_ORIGINS` used to add `"null"` to the trusted set, and any custom-scheme `Origin` then matched it.
  - App fixes found reading the code path: the expo client's `getCookie` is async since the parked era, so tRPC HTTP and WebSocket requests sent `Cookie: [object Promise]`. The provider now reads the client's chunked SecureStore entry synchronously through `storageAdapter` + `getCookie`. The auth client's base URL is now `<server>/api/auth`, since Better Auth treats a URL that has a path as the auth root and base-path servers got requests at `/<base>/sign-in/...`.
  - Left for ticket 09: `readPersistedSession` reads SecureStore keys directly, so a session large enough for the expo client to chunk would read as unparseable while offline.
