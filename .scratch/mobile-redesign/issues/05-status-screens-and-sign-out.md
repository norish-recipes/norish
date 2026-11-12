# 05: Signing in, Sign-in failed, Storage unavailable, and Sign-out's landing

**What to build:** The OAuth callback, the provider error and unreadable storage move onto the status layout from the new boards. Sign-out returns to Sign in with a transition. See `.scratch/mobile-redesign/spec.md` ("Status screens", "Server Address and the version gate") and the SigningIn, SignInFailed and StorageUnavailable boards. Read the boards' comments first: they may have changed since this ticket was written.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Signing in (`auth/callback`): the splash with a spinner under the slogan and no action.
- [ ] Sign-in failed (`auth/error`): the danger badge shakes once and rings once. The line names the provider ("{provider} didn't sign you in."). Try again goes back to Sign in. The server chip is shown.
- [ ] Storage unavailable: the warning badge and Try again. There's no chip, and the raw error is no longer shown (it is still logged). `storage-unavailable.styles.ts` is removed.
- [ ] Sign-out: the smoke screen's button and native confirm stay. The reader lands on Sign in for the same Server Address with a fade.
- [ ] Gates green.
