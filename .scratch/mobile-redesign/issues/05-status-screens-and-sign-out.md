# 05: Signing in, Sign-in failed, Storage unavailable, and Sign-out's landing

**What to build:** The OAuth callback, the provider error and unreadable storage move onto the status layout from the new boards. Sign-out returns to Sign in with a transition. See `.scratch/mobile-redesign/spec.md` ("Status screens", "Server Address and the version gate") and the SigningIn, SignInFailed and StorageUnavailable boards. Read the boards' comments first: they may have changed since this ticket was written.

**Blocked by:** 04

**Status:** done

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

### Review log (2026-11-12)

Range `5b4bdd06e..de7fd6d8c`. Two axes, then one re-review of the fix round.

Fixed:
- Signing in: spinner 40pt under the slogan, the splash's own placement helper (`useSplashBrandTop`), and a 15 s foreground-only deadline that ends on Sign-in failed (`resolveSigningIn`, `useSigningIn`). `d3bb7afd2`, `d40971d08`, `0aa2c52d8`, `3e3eb3550`
- Sign-in failed: the provider comes only from the route's `provider` param (the module-level "last tapped provider" is gone); the line is decided once, when the provider list has settled; no stack header. `8e8710b9f`, `f9cc37d43`
- Sign-out and Session Expiry: every phase on the theme's background, the pending spinner delayed 400 ms, Sign in fading in once; the fade flag is one-shot and tied to the Server Address the session ended on (`fadesIntoSignIn`). `1821216ec`, `b53d3e1a6`, `de7fd6d8c`
- The storage error is logged once; one glyph renderer in the badge; Dutch "Signing in" reads as progress. `e19153e11`, `89a6d9639`, `1f2992a68`

Checked, no change needed:
- `StatusScreen`'s refresh icon only reaches real retries; the inline `AuthStatus` actions draw no icon.
- No comment in the range is over two lines.

Decided: Signing in keeps the logo at the splash's 398pt (the board's markup, which centres the spinner in the group, works out to 366pt): the spec calls it "the splash with a spinner".

Rejected:
- Neutral wording for "this iPhone's keychain": the spec is iPhone only.
- Component tests for the three screens: Maestro covers screens (spec, "Testing Decisions").
- Merge the three screens' `StatusScreen` configurations; move badge label keys; types for badge params: thin configuration that reads as it is.

Asked (open): a provider-side failure never reaches Sign-in failed. On iOS the sign-in sheet hands every `norish://` URL back to `@better-auth/expo`, which returns early on a URL with no cookie (`dist/client.js` ~677), so a cancelled sheet and a failed provider look the same to the app and the failed line can never name a provider in practice. Options: patch `@better-auth/expo` to return the error (recommended, the repo's first pnpm patch); open the sheet in the app with `disableRedirect` and rebuild the plugin's proxy URL, state and cookie storage; or leave the server's error page in the sheet.

Not this spec: on Android the Custom Tab's return link probably reaches the router, so Signing in and its deadline would show during ordinary sign-ins there.

Device run (06): Sign-out and Session Expiry reading as one fade, the three status screens against their boards (light and dark), badge animations and tap replay, Storage unavailable's Try again.

