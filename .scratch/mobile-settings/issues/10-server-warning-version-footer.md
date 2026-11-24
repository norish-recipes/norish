# 10: Server change warns, version is a footer

**What to build:** Mike, with ticket 09's build on his iPhone (2026-11-24): "The server url changing could use a warning that you will logout. App info can just be grey text at the bottom, doesn't need to be a section actually."

**Blocked by:** 09

**Status:** done

- [x] Signed in, tapping Server in Settings always asks first: one native alert that says changing the server signs you out, with Cancel and a destructive "Change server". Cancel leaves everything as it was.
- [x] With unsynced changes in the Outbox the existing "Discard unsynced changes?" alert is the one alert shown (it already says signing out); never two alerts in a row.
- [x] Signed out (the server chip on the auth screens) nothing changes: no alert.
- [x] The Version row is gone. The same line (app version, build, server version) is small grey centred text under Sign out, not a row and not in a group. It keeps the testID `settings-root-version` and is read by VoiceOver as plain text.
- [x] The App section keeps Server and Support.
- [x] New copy in all 18 locales; keys the Version row alone used are removed.
- [x] Maestro: `settings-open` still passes; a flow taps Server, sees the alert, cancels and is still on Settings.
- [x] Gates green.

Docs: `apps/docs/docs/mobile.md` and the 0.28.0-beta release notes are corrected by Terra after the code, if they name the Version row or the server change.

## Comments

### Implemented (2026-11-24, 6bb3be044)

- `leaveConfirm(unsynced, serverChange)` in `lib/discard-confirm.ts` picks the one alert (discard, else "Change server?", else none); `useConfirmedSignOut` takes a `serverChange` flag that only `changeServerAddress` sets, so the plain Sign out row and the signed-out chip behave as before. The Version row is now a muted 13 pt centred `Text` under Sign out (`settings-root-version`). `settings.mobile.changeServer.*` added in 18 locales, `settings.mobile.version` removed. New flow `settings-server-warning`.
- Ran: all seven gates 0 (mobile lint 11 warnings); Release build on iPhone 18 Pro; `settings-open`, `settings-server-warning` and `sign-out` passed once each. By hand: footer (light) and the alert looked at.
- Alert: "Change server?" / "You will be signed out of this server." / Cancel, Change server (destructive).
- Not seen: the footer in dark, the alert with unsynced changes (covered by the unit test only), the non-English copy on a device.

### Review and exit (2026-11-24)

Review (Opus medium, `6bb3be044`, read only): no behaviour bug. Dispositions, all fixed by the gatekeeper in `16ae258d5`:
- fix: the Bulgarian line said "unsubscribed" in the formal register; it now says "Ще излезеш от профила си в този сървър."
- fix: es, fi and pt-BR worded the action differently from the sign-in screen's server chip; fr, it, pl and pt-BR used a masculine-only form. Reworded to match the chip and to be neutral.
- fix: the hook test only covered the discard alert. Added: nothing unsynced signs out at once; a server change with nothing unsynced warns and keeps the Outbox; the button's label.
- fix: on a server change with unsynced changes the discard alert's button said "Sign out"; it now says "Change server".

Docs (Terra, `79eaa4cc6`): `mobile.md`'s App sentence; the release notes were still true.

Exit at `16ae258d5`: `format:check`, `i18n:check`, mobile `lint` (11 warnings), mobile `typecheck` and the whole `test:run` 0. Not re-run after the review fixes (strings, a test, one label): `deps:cycles`, `build`, the Maestro flows. Not seen: the footer in dark, the alert with unsynced changes on a device, non-English copy on a device.
