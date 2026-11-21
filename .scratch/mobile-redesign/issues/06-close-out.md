# 06: Maestro, docs and release notes for sign-in

**What to build:** The sign-in area's acceptance run and its docs. See `.scratch/mobile-redesign/spec.md` ("Testing Decisions").

**Blocked by:** 05

**Status:** done

- [x] The Maestro flows are updated to the new screens: `subflows/sign-in.yaml`, `subflows/credentials.yaml`, `sign-out.yaml`, `old-server/update-server.yaml` and every flow that signs in.
- [x] A new Sign up flow against a throwaway server with sign-ups open.
- [x] One full Maestro run after tickets 01–05 have been reviewed and fixed, with failures fixed. Each new or changed flow is run repeatedly to prove it is stable.
- [x] Docs (the mobile app page in `apps/docs`, with iPhone screenshots of the new sign-in screens) and the 0.27.0-beta release notes line, both written by Terra.
- [x] Gates green.

## Comments

- Flows select by testID (Sign up links, error lines, `server-chip`) and share `subflows/connect.yaml`. New: `wrong-credentials`, `unreachable-server`, `server-chip`; `sign-out` and `update-server` now assert the host and both versions.
- The password sheets are gone, not dismissed: `scripts/maestro.mjs` writes `com.apple.WebUI AutoFillPasswords=false` on the simulator (found by diffing Settings > AutoFill & Passwords; Maestro cannot see the sheets). Set `NORISH_SIMULATOR` to the udid when several are booted.
- The script takes one flow path, checks that opening registration worked, and restores it when the run ends. A "no Sign up link while closed" check needs a run before registration opens (a restructure), so it is not there.
- Full set on an iPhone 18 Pro (iOS 27.2) green; each flow then passed five times in a row. Docs and release notes checkbox left to Terra; CONTRIBUTING's Maestro section should mention the Sign up flow and `NORISH_SIMULATOR`.
- Final review gaps closed: `scripts/maestro.mjs` now runs a version proxy (:3999) to the real server; flows switch it with `/old` and `/real` on the control port, and `/revoke-other-sessions` ends the app's session through the server's own API.
- New flows: `launch-too-old`, `launch-too-old-signed-in` (chip signs out, Server address opens pre-filled), `foreground-recovery`, `session-expiry`, `sign-in-failed` (named and unnamed), `signing-in-deadline`; `update-server` is now `connect-version-check`. Storage unavailable is not reachable on a simulator without code changes.
- iPhone 18 Pro (iOS 27.2), rebuilt Release at 11340fbbc: two full runs of 16 flows green, each new flow five times in a row green.

### Review log (2026-11-12 and 13)

Flows `779a25748..970ffcd78`, docs `98e1c20ab..703e8f362`. One review of the flows, a device check of every sign-in screen on the iPhone 18 Pro (iOS 27.2), then the whole-branch review (Spec on Opus high, Standards on Sonnet low, GPT-6.1 Sol) from `e4a94c883`.

Flows, fixed:
- No position taps (the runner turns off the simulator's password AutoFill prompts); selectors by testID; Sign-out asserts the same server on the chip; Update your server asserts both versions; one `subflows/connect.yaml`. `4da4ce188`, `31f5c6326`
- New flows: wrong credentials, unreachable server, server chip. `ee57f6083`
- The runner checks and restores the registration setting, runs one flow, takes `NORISH_SIMULATOR`. `4da4ce188`
- From the final review: a proxy that switches the reported version and can end the app's session, and flows for a launch against a saved too-old server (signed out and signed in, with the chip's server change), foreground recovery, Session Expiry, Sign-in failed and Signing in's deadline. `25dae1e5f`, `bf49cf333`

Device check, fixed (tickets 01-05's code): the per-app language (`Settings.get("AppleLanguages")`), Sign-out and the chip's Sign-out as fades, Update your server opening under the splash, Sign-in failed's copy and layout, Sign up's position, the chip's height, popovers opening below, VoiceOver labels without icon glyphs, an inline error clearing on edit, the label gap, testIDs for the flows. `5577e6e22`..`291e78883`

Whole-branch review, fixed:
- A too-old server is held as module state across the provider's re-key; a deep-linked `/update-server` is checked first; the foreground re-check stays armed after a failed save; an auth-session expiry fades out; the server change is set only once Sign-out proceeds; the splash slogan waits for its language; the no-server copy says Server address. `66c315328`..`8c781b494`
- Clean-up: the dead locale store, duplicated blocks, leftover memo, reason codes in `lib` in place of auth copy ids, `boot-state.ts` split by concern, unused exports, mobile's three old lint warnings. `67b75716e`..`11340fbbc`
- Docs: the mobile page's "moves on by itself" and language lines, Sign-in failed and Storage unavailable, CONTRIBUTING's Maestro section. `60c057271`, `d8f53ace3`, `703e8f362`

Checked, no change needed: after the chip's Sign-out the reader does land on Server address (the stack is unmounted during Sign-out, so the router reseeds it at the entry route); a reviewer read it otherwise, the device and the new flow agree with the code.

Rejected: moving the session-end state out of the session sync; moving the two Sign-out hooks into the auth feature (the smoke screen and the root layout use them); one shake for fields and badges (different board motions); replacing the launch's frame-stepped clock (it fixed the flicker); removing English keys this branch did not add.

Not added: a flow for Storage unavailable (unreachable on a simulator without changing code); a check that Sign in hides the Sign up link while registration is closed (needs a second Maestro invocation; the rule is unit-tested).

Final state, `703e8f362`: all gates exit 0 with the unit tests forced to run, the docs site builds, mobile lint has no warnings, and Maestro passed twice (12 of 12 and 4 of 4 in `old-server`) with each new flow 5 of 5 alone.

Open for the maintainer: the `@better-auth/expo` patch so a provider failure reaches Sign-in failed (ticket 05); the light splash logo's colour step (ticket 01); `expo install --check` names 11 Expo packages one or two patches behind, older than this branch.

