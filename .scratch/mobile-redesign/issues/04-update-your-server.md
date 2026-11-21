# 04: Update your server

**What to build:** Update your server rebuilt from the UpdateServer board, on the status layout later screens share. The version gate also runs at launch and when the app returns to the foreground. See `.scratch/mobile-redesign/spec.md` ("Server Address and the version gate", "Status screens") and the UpdateServer board.

**Blocked by:** 02

**Status:** done

- [x] Status layout: badge, title, one line, an optional action, and the optional server chip. Update your server uses it with the badge's arrow nudge and one ring, replayed on tap. There's no Retry and no back button. The chip opens Server address.
- [x] Launch: a background check against the saved Server Address. If the server is too old, go to Update your server. If it's unreachable, skip the check and carry on (Offline if need be). The check never delays the first screen.
- [x] Foreground: while Update your server shows, each return to the foreground re-checks. Once the server is new enough, continue to Sign in, saving the address if it wasn't saved yet.
- [x] Unit tests for the launch and foreground decisions: too old, new enough, unreachable.
- [x] testID `update-server-description` is kept.
- [x] Gates green.

## Comments

- `/update-server` moved from `(auth)` to a root route outside the sign-in guard, so the launch check can reach it signed in; it has no header, back or swipe, and carries `address` and `version` as params. Description has a fallback line when the server reports no version.
- `AuthStatus` takes a `badge` to become the whole-screen status layout (callers without one render as before); the badge is react-native-svg driven by one Reanimated clock with the board's keyTimes and splines, and is skipped under Reduce Motion.
- Launch check starts once the session has settled (the navigator is mounted), never touches the splash; the foreground re-check saves the address then dismisses to what the screen was pushed over, or replaces with Sign in if the address was new.
- Untested on device: the chip while signed in (the `(auth)` stack is guarded off then, and Settings' sign-out-first row isn't built). Maestro `old-server/update-server.yaml` regex updated to the board's wording; no flow for the foreground path.

### Review log (2026-11-12)

Range `e795f5a0f..93a25cb4c` (minus `2594fe3c2`, `b61a7cf19`, `ce359f914`, which belong to tickets 01-03). Two axes, then two re-reviews of the fix rounds.

Fixed:
- Signed in on a too-old server, the chip signs out first (same unsynced-work confirm, cancel keeps the session), then Server address opens pre-filled: one `changeServerAddress()` for every chip, the confirm shared with the smoke screen. A failed or cancelled Sign-out drops the pending change; the signed-out entry reads it at first render. `bc682c040`, `232a9b87b`, `3d50b1b1c`
- `/update-server` with nothing to check opens the signed-out entry. `5ca661b44`
- The foreground re-check runs only while the screen is focused, one at a time, and drops a late result. `3f1596711`
- A new-enough server returns a signed-in reader to the app; signed out it saves the address and opens Sign in. `9f84fc6b1`
- The launch check runs once per launch for the saved address, survives the provider's re-key and a storage retry, and navigates only after the launch has finished. `e656f60dd`, `9d0b4949c`, `dbd1478fc`, `93a25cb4c`
- `StatusScreen` composes `AuthLayout` (a `status` variant: no foot padding, no bounce), the inline `AuthStatus` and `AuthSubmitButton`; block top at the board's 335pt. `9590c364a`, `ea847eec2`
- One `ServerAddressCheck` in `lib/network/server-address.ts`; the badge clock's `play()` in `utils/motion.ts`. `6dbc594ee`, `c566f121a`
- Tests: badge motion at the board's keyTimes, `serverVersionOf`, the versionless too-old branch, `updateServerHref`, the re-check hook, the launch check across a remount. `1ee319647`, `c04463952`, `3f1596711`, `dbd1478fc`
- Three `jsx-sort-props` warnings left by earlier rounds. `2a7355ea7`

Rejected:
- Drop `descriptionTestID`: the Maestro flow reads `update-server-description`.
- Types for the decision strings and for address + version: a string union and two fields say it.
- `bounces={false}` on the status screen: content that overflows under large Dynamic Type should still scroll and bounce.

Accepted as built: the stack mounted after onboarding's first Connect runs one more check of the address Connect just checked (it answers new enough; the storage-retry case needs the check to run there).

For the docs writer (06): CONTRIBUTING's route wording, now that `/update-server` sits outside `(auth)`.

Device run (06): the chip's Sign-out landing on Server address across the stack's re-key, the launch check opening Update your server after the splash (signed out and signed in), the foreground re-check, the badge's animation and tap replay.

