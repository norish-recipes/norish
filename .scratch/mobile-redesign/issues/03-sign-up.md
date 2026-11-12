# 03: Sign up

**What to build:** Sign up rebuilt from the Register board, with the native header back button, the password rule in a popover and the "closed" error. See `.scratch/mobile-redesign/spec.md` ("Look", "Errors", "Sign-in Methods") and the Register board.

**Blocked by:** 02

**Status:** ready-for-agent

- [x] Layout per the board: "Sign up for" above the logo, the Name, Email, Password (with an `i` popover) and Confirm password fields, the Create account button, and "Already have an account? Sign in" at the bottom. Back is the native stack header's button.
- [x] The password rule comes from `auth.signup.passwordDescription` in the popover. The hard-coded English hint is gone.
- [x] Validation errors (required, too short or long, passwords don't match) use the inline pattern. A server refusing sign-ups shows "Sign-ups are closed on this server."
- [x] AutoFill content types: `username` on email, `newPassword` on both password fields.
- [x] `register.styles.ts` is removed.
- [x] Stable testIDs on every field and the submit button, for the new Maestro flow.
- [x] Gates green.

## Comments

- Sign up is `SignUpForm` (components) under `RegisterScreen`, on `useAuthAttempt`: validation runs as an attempt keyed by field (that field shakes, one line under the form), the server call under `signUp` (no deadline; the button shakes). The button stays enabled so "required" can show.
- A refusing server returns `REGISTRATION_IS_CURRENTLY_DISABLED` (`packages/auth` user-create hook); `auth-failure.ts` maps it to the new `auth.signup.errors.closed`, so web's `registration_is_currently_disabled` keys are no longer used by mobile except the closed-state title. New keys: `closed`, `passwordHelp` (popover's VoiceOver label); English "Confirm password" lowercased to the board.
- Ticket 02's finding held: `useAuthProvidersQuery` now returns `isPaused`, and `resolveMethodsStatus` (tested) makes a first fetch paused offline the retry state. `LoginStatus` became `AuthStatus`, shared with Sign up. Back is the stack's, icon only (`headerBackButtonDisplayMode: "minimal"` in the `(auth)` layout).
- Unverified until Maestro/device: the header back button over the centred block, popover on the `i`, AutoFill, keyboard avoidance with four fields. Docs: none for the writer beyond release notes ("Sign-ups are closed" copy).
