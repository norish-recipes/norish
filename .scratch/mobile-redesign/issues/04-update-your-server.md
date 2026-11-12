# 04: Update your server

**What to build:** Update your server rebuilt from the UpdateServer board, on the status layout later screens share. The version gate also runs at launch and when the app returns to the foreground. See `.scratch/mobile-redesign/spec.md` ("Server Address and the version gate", "Status screens") and the UpdateServer board.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Status layout: badge, title, one line, an optional action, and the optional server chip. Update your server uses it with the badge's arrow nudge and one ring, replayed on tap. There's no Retry and no back button. The chip opens Server address.
- [ ] Launch: a background check against the saved Server Address. If the server is too old, go to Update your server. If it's unreachable, skip the check and carry on (Offline if need be). The check never delays the first screen.
- [ ] Foreground: while Update your server shows, each return to the foreground re-checks. Once the server is new enough, continue to Sign in, saving the address if it wasn't saved yet.
- [ ] Unit tests for the launch and foreground decisions: too old, new enough, unreachable.
- [ ] testID `update-server-description` is kept.
- [ ] Gates green.
