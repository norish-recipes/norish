# 03: Sign up

**What to build:** Sign up rebuilt from the Register board, with the native header back button, the password rule in a popover and the "closed" error. See `.scratch/mobile-redesign/spec.md` ("Look", "Errors", "Sign-in Methods") and the Register board.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Layout per the board: "Sign up for" above the logo, the Name, Email, Password (with an `i` popover) and Confirm password fields, the Create account button, and "Already have an account? Sign in" at the bottom. Back is the native stack header's button.
- [ ] The password rule comes from `auth.signup.passwordDescription` in the popover. The hard-coded English hint is gone.
- [ ] Validation errors (required, too short or long, passwords don't match) use the inline pattern. A server refusing sign-ups shows "Sign-ups are closed on this server."
- [ ] AutoFill content types: `username` on email, `newPassword` on both password fields.
- [ ] `register.styles.ts` is removed.
- [ ] Stable testIDs on every field and the submit button, for the new Maestro flow.
- [ ] Gates green.
