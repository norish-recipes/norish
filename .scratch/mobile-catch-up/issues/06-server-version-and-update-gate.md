# 06: Server version and the "update your server" screen

**What to build:** A household member who points the app at a server older than it supports is told so before sign-in: a screen says their server needs Norish at or above a named minimum version, and the app goes no further. The server reports its version in its readiness response so the app, and anyone's monitoring, can read it. See `.scratch/mobile-catch-up/spec.md`, "Server version and the version gate".

**Blocked by:** 04 (the Maestro harness)

**Status:** ready-for-agent

- [x] `/health/ready` and the deprecated `/health`, which mirrors it, return a `version` field carrying the running server version. The OpenAPI document describes it.
- [x] The existing health procedure tests assert `version` on both endpoints.
- [x] The app's minimum server version is the current release's minor, derived from the app version, so it moves with each release and is never edited by hand.
- [x] The server-address step reads `version` from its existing probe. Below the minimum, or when the field is missing (a server from before this change), it shows the "update your server" screen naming the minimum version and does not offer sign-in.
- [x] The screen's copy is in the i18n messages, and `pnpm i18n:check` passes.
- [x] A Maestro flow against a server reporting an older version reaches the update screen. Repeated runs show it is stable.
- [x] The 0.27.0-beta release notes say the readiness response now reports the server version.

## Comments

- 2026-11-05 — Done apart from running the Maestro flow, blocked like tickets 02 and 04: SDK 58 needs Xcode 27 to build the app, this Mac has Xcode 26.3, and Maestro is not installed. `apps/mobile/maestro/old-server/update-server.yaml` is written but has never run, so its box stays open.
  - The server reads its version from `NEXT_PUBLIC_APP_VERSION`, which Next inlines from the root package.json, as the web app's version menu does. The published `openapi.json` is regenerated.
  - The app keeps probing `/api/v1/health`, the deprecated endpoint: a server older than 0.26 has no `/health/ready`, and it would read as unreachable instead of too old. Ticket 09 moves the probe to the readiness endpoint.
  - The runner serves the old server itself, a stub on port 3999 that reports `0.1.0`, and runs the `old-server/` folder after the main flows; `maestro test` does not descend into subfolders. It spawns Maestro asynchronously now so the stub can answer.
  - The comparison reuses `isUpdateAvailable` from `@norish/shared/lib/version`. Per the spec it has no unit test of its own.
  - The update screen is pushed, not replaced, so the header's back button returns to the server-address step. The address is not saved.
- 2026-11-08 — `old-server/update-server.yaml` passes in all 13 full runs on Xcode 27.2.
- 2026-11-08 — Correction to the comment above: `server-version.test.ts` does unit-test the comparison (added in 5fde14401 with the foreign-server check). It stays; the Maestro flow covers the screen. The gate runs only at the server-address step, so an app updated past a saved server's version is not stopped until the address is entered again. The spec's Implementation Decisions ask for exactly this; re-checking a saved server is a follow-up.
