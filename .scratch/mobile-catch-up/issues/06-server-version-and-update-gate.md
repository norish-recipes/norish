# 06: Server version and the "update your server" screen

**What to build:** A household member who points the app at a server older than it supports is told so before sign-in: a screen says their server needs Norish at or above a named minimum version, and the app goes no further. The server reports its version in its readiness response so the app, and anyone's monitoring, can read it. See `.scratch/mobile-catch-up/spec.md`, "Server version and the version gate".

**Blocked by:** 04 (the Maestro harness)

**Status:** ready-for-agent

- [ ] `/health/ready` and the deprecated `/health`, which mirrors it, return a `version` field carrying the running server version. The OpenAPI document describes it.
- [ ] The existing health procedure tests assert `version` on both endpoints.
- [ ] The app's minimum server version is the current release's minor, derived from the app version, so it moves with each release and is never edited by hand.
- [ ] The server-address step reads `version` from its existing probe. Below the minimum, or when the field is missing (a server from before this change), it shows the "update your server" screen naming the minimum version and does not offer sign-in.
- [ ] The screen's copy is in the i18n messages, and `pnpm i18n:check` passes.
- [ ] A Maestro flow against a server reporting an older version reaches the update screen. Repeated runs show it is stable.
- [ ] The 0.27.0-beta release notes say the readiness response now reports the server version.
