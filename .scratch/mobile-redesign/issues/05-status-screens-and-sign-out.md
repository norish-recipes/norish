# 05: Signing in, Sign-in failed, Storage unavailable, and Sign-out's landing

**What to build:** The OAuth callback, the provider error and unreadable storage move onto the status layout from the new boards. Sign-out returns to Sign in with a transition. See `.scratch/mobile-redesign/spec.md` ("Status screens", "Server Address and the version gate") and the SigningIn, SignInFailed and StorageUnavailable boards. Read the boards' comments first: they may have changed since this ticket was written.

**Blocked by:** 04

**Status:** ready-for-agent

- [x] Signing in (`auth/callback`): the splash with a spinner under the slogan and no action.
- [x] Sign-in failed (`auth/error`): the danger badge shakes once and rings once. The line names the provider ("{provider} didn't sign you in."). Try again goes back to Sign in. The server chip is shown.
- [x] Storage unavailable: the warning badge and Try again. There's no chip, and the raw error is no longer shown (it is still logged). `storage-unavailable.styles.ts` is removed.
- [x] Sign-out: the smoke screen's button and native confirm stay. The reader lands on Sign in for the same Server Address with a fade.
- [x] Gates green.

## Comments

- Boards and comments read live (Artifact and ArtifactComments, 2026-11-12); no thread sits on SigningIn, SignInFailed or StorageUnavailable, but 14 older threads were cut by the size cap and not read.
- Signing in draws the brand at the splash's 398pt, not the board's markup (which centres the spinner too and puts the logo at ~372pt), so Launch hands off without a jump.
- One `StatusBadge` with update/failed/storage variants (timings as pure functions, tested at the boards' keyTimes). Provider name: route `provider` param, else the last provider tried (module state), else "The sign-in didn't go through." (`failed-provider.ts`).
- Sign-out fade: the snapshot gains `leftSession`; the re-keyed session stack fades in once on arrival (also Session Expiry), plain fade under Reduce Motion. Not seen on a device. The spinner view still shows briefly first.
- Raw storage error is logged only; `detailsLabel` dropped from all locales. Docs writer: Storage unavailable and Sign-in failed screens, release notes.
