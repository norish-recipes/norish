# 04: Update your server

**What to build:** Update your server rebuilt from the UpdateServer board, on the status layout later screens share. The version gate also runs at launch and when the app returns to the foreground. See `.scratch/mobile-redesign/spec.md` ("Server Address and the version gate", "Status screens") and the UpdateServer board.

**Blocked by:** 02

**Status:** ready-for-agent

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
