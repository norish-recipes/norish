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

- Flows wait on elements (the splash plays first) and select by testID. The Sign in → Sign up link, "Already have an account? Sign in" and the mismatch error have no testID, so `sign-up.yaml` matches their text: app gap, report only.
- Two iOS system sheets covered the app and Maestro cannot reliably see them: "Use Strong Password?" on Sign up (closed by position) and "Save Password?" after sign-in and after each relaunch (`subflows/dismiss-*.yaml`, tapped by position until the smoke screen shows).
- `scripts/maestro.mjs` now re-opens registration after seeding the first Account, which closes it; Sign up needs it open.
- Full run and five more set runs on an iPhone 17 (iOS 27.2) all green, so each flow passed six times in a row; no app defects found. Docs and release notes checkbox left to Terra; CONTRIBUTING's Maestro section should mention the Sign up flow.
