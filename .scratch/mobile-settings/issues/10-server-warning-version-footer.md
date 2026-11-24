# 10: Server change warns, version is a footer

**What to build:** Mike, with ticket 09's build on his iPhone (2026-11-24): "The server url changing could use a warning that you will logout. App info can just be grey text at the bottom, doesn't need to be a section actually."

**Blocked by:** 09

**Status:** open

- [ ] Signed in, tapping Server in Settings always asks first: one native alert that says changing the server signs you out, with Cancel and a destructive "Change server". Cancel leaves everything as it was.
- [ ] With unsynced changes in the Outbox the existing "Discard unsynced changes?" alert is the one alert shown (it already says signing out); never two alerts in a row.
- [ ] Signed out (the server chip on the auth screens) nothing changes: no alert.
- [ ] The Version row is gone. The same line (app version, build, server version) is small grey centred text under Sign out, not a row and not in a group. It keeps the testID `settings-root-version` and is read by VoiceOver as plain text.
- [ ] The App section keeps Server and Support.
- [ ] New copy in all 18 locales; keys the Version row alone used are removed.
- [ ] Maestro: `settings-open` still passes; a flow taps Server, sees the alert, cancels and is still on Settings.
- [ ] Gates green.

Docs: `apps/docs/docs/mobile.md` and the 0.28.0-beta release notes are corrected by Terra after the code, if they name the Version row or the server change.

## Comments
