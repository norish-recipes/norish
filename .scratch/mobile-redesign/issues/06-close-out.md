# 06: Maestro, docs and release notes for sign-in

**What to build:** The sign-in area's acceptance run and its docs. See `.scratch/mobile-redesign/spec.md` ("Testing Decisions").

**Blocked by:** 05

**Status:** ready-for-agent

- [x] The Maestro flows are updated to the new screens: `subflows/sign-in.yaml`, `subflows/credentials.yaml`, `sign-out.yaml`, `old-server/update-server.yaml` and every flow that signs in.
- [x] A new Sign up flow against a throwaway server with sign-ups open.
- [x] One full Maestro run after tickets 01–05 have been reviewed and fixed, with failures fixed. Each new or changed flow is run repeatedly to prove it is stable.
- [ ] Docs (the mobile app page in `apps/docs`, with iPhone screenshots of the new sign-in screens) and the 0.27.0-beta release notes line, both written by Terra.
- [ ] Gates green.

## Comments

- Flows select by testID (Sign up links, error lines, `server-chip`) and share `subflows/connect.yaml`. New: `wrong-credentials`, `unreachable-server`, `server-chip`; `sign-out` and `update-server` now assert the host and both versions.
- The password sheets are gone, not dismissed: `scripts/maestro.mjs` writes `com.apple.WebUI AutoFillPasswords=false` on the simulator (found by diffing Settings > AutoFill & Passwords; Maestro cannot see the sheets). Set `NORISH_SIMULATOR` to the udid when several are booted.
- The script takes one flow path, checks that opening registration worked, and restores it when the run ends. A "no Sign up link while closed" check needs a run before registration opens (a restructure), so it is not there.
- Full set on an iPhone 18 Pro (iOS 27.2) green; each flow then passed five times in a row. Docs and release notes checkbox left to Terra; CONTRIBUTING's Maestro section should mention the Sign up flow and `NORISH_SIMULATOR`.
- Final review gaps closed: `scripts/maestro.mjs` now runs a version proxy (:3999) to the real server; flows switch it with `/old` and `/real` on the control port, and `/revoke-other-sessions` ends the app's session through the server's own API.
- New flows: `launch-too-old`, `launch-too-old-signed-in` (chip signs out, Server address opens pre-filled), `foreground-recovery`, `session-expiry`, `sign-in-failed` (named and unnamed), `signing-in-deadline`; `update-server` is now `connect-version-check`. Storage unavailable is not reachable on a simulator without code changes.
- iPhone 18 Pro (iOS 27.2), rebuilt Release at 11340fbbc: two full runs of 16 flows green, each new flow five times in a row green.
