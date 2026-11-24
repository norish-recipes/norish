# 02: Profile, sign-in methods and delete account

**What to build:** The Profile sub-page (`StProfile`, `StPassword`, `StSignInSwiped`, `StDeleteAccount`), mirroring web's profile, sign-in methods and danger zone cards on `@norish/shared-react/reader`.

**Blocked by:** 01

**Status:** done

- [x] Name edit with Save; avatar change via the photo picker uploaded as an `expo-file-system` `File`, and avatar removal.
- [x] Change password sheet (only when the account has a password).
- [x] Sign-in methods listed; link opens the system auth session the app's OIDC sign-in uses; unlink by swipe or long-press; the last method cannot be removed.
- [x] Delete account behind a destructive confirm, with web's admin note (`deleteModal.adminNote`); after deletion the app returns to sign-in.
- [x] Gates green.

## Comments

- Profile page is `ProfileForm` (photo, name, email, Save), `SignInMethods` and `DangerZone` over `profile-rules.ts` (tested); the password sheet is the `settings/password` route (fit sheet in the settings stack). Photo and name wait for Save like web; Remove photo acts at once. Offline: inputs, Save, photo, link, unlink, password row and delete are off, and nothing is queued.
- Link and unlink call `authClient.linkSocial` / `unlinkAccount` from `useAuthClient()`; the Expo client opens the system auth session, so no auth-feature file was touched. A cancelled session changes nothing and the list rereads. Web's `?error=` return has no mobile equivalent: a refusal is toasted from the call's error code.
- Deviations: the delete confirm shows the admin note only for an admin whose household has other members (or while the household loads), not always as web does. `ProviderIcon` moved to `components/` so settings can draw it (one import in `provider-buttons.tsx`). `uploadAvatar` now takes a `Blob` (an expo `File`). New keys `settings.mobile.avatarHint` and `changePhoto` in all locales.
- Not done: password and sign-in sheets, swipe and the system auth session are untested on a device. Docs writer: Profile page (photo, name, sign-in methods, password, delete account) on mobile.

### Review round 1 (2026-11-23): dispositions

Standards (Haiku):
- fix: `danger-zone.tsx` draws its own confirm alert; use `useConfirm()`.
- fix: `PASSWORD_MIN`/`PASSWORD_MAX` duplicate `packages/shared` `MIN_PASSWORD_LENGTH`/`MAX_PASSWORD_LENGTH`.
- fix: `ERROR_KEYS` copies web's map in `sign-in-methods-card.tsx`; one shared map both apps use.
- verify: `password-screen.tsx` redraws auth's `InlineErrorBlock`; move it to `components/` only if no file the other session has open needs editing, else leave and report.
- fix: bare `"credential"` where `SIGN_IN_METHODS.credential.id` exists.
- fix: Offline dimming as inline `opacity` in `profile-form.tsx`; same class as `SettingsRow`.
- fix: needless non-null assertions (`authClient!`, `asset!.uri`).
- fix: avatar markup drawn in `profile-form.tsx` and `profile-card.tsx`; one component (`account-menu.tsx` is the other session's and stays).
- fix: provider icon tile copies `SettingsRow`'s classes; the row takes the icon instead.
- fix: the `.catch(() => ({ error: {} }))` wrapper twice; one helper.
- fix: names `run`, `removePhoto`.
- verify, bug: `save()` leaves `saving` set when `updateName` throws.
- reject: reuse web's `avatarHint` key (web's text says "Click your avatar"; a phone needs "Tap").
- reject: split `profile-rules.ts` by area (87 lines of rules for one screen; four tiny files help nobody).

Spec (Opus medium):
- fix: a refused link shows no error; the Expo client drops the `?error=` the return URL carries.
- fix: the admin note is conditional; the ticket says web's note, and web always shows it.
- fix: `save()` clears the typed name even when the save fails.
- fix: Remove photo stays enabled while a save runs.

Round 1 outcome: fixed in `bb9da562c` (shared error map) and `ba1e1ca40` (the rest). Not fixed: the `InlineErrorBlock` move (auth's `password-form.tsx` imports it and `auth/utils/motion.ts` is modified; both belong to the other session), `save()` stuck on saving (doesn't hold: `updateName` and `uploadAvatar` swallow rejections), and the silent refused link (ask: `@better-auth/expo` exposes no `?error=`; the options are running the auth session ourselves or accepting it).

### Review round 2 (2026-11-23): fix range `da67de584..ba1e1ca40` (Sol medium)

- fix, bug: a name arriving from the server clears an unsaved draft (`profile-form.tsx:45`).
- fix, bug: a whitespace-only edit keeps Save enabled and rewrites on every tap (`profile-rules.ts:20`).
- verify, bug: a stale save (`{ success: true, stale: true }`) neither refreshes the profile nor reports, so a retry repeats it (`use-account-mutations.ts:34`).
- fix: lint warnings this run added in the settings files (`settings-group.tsx`, `version-line.ts`); the exit gate showed mobile at 14 warnings against a baseline of 11.

Round 2 outcome: fixed in `34a29ea31` (name-field rules), `1e3d312f0` (stale write rereads, confirmed with a failing test) and `1e71ae545` (lint warnings back to the baseline's 11). Exit gates all 0 at `1e71ae545`.

### Review round 3 (2026-11-23): fix range `ba1e1ca40..1e71ae545` (Opus medium)

- fix, bug: the stale reread is not awaited (`use-account-mutations.ts:45`), so the photo upload after a stale name save goes out stale too.
- fix: a stale answer shows nothing; report it the way the app reports other refused saves.
- fix, bug: a draft that would send nothing (whitespace only, or equal to a name renamed elsewhere) is never dropped and can later undo the other device's rename. Dropped on blur, not while typing, or the space in "Ada Lovelace" could not be typed.
- fix: the save sequence (name, then photo, outcomes back into draft and photo) is untested; it moves to a plain function with tests.

Round 3 outcome: fixed in `8b9991c29` (stale write resolves after the reread), `e10824c4b` (stale says "it changed elsewhere", web too), `51e8a42cc` (a draft that sends nothing drops once the field is left) and `b339f4daa` (`saveProfile` with tests; a name that doesn't go through stops the save and leaves the photo staged). Exit gates all 0 at `b339f4daa`, mobile lint at the baseline's 11 warnings. No fourth re-review: the final whole-branch pass reads this flow.

Open after this ticket: the silent refused link (ask), and the `InlineErrorBlock` move once the other session's auth work is committed.

### Mike's decision (2026-11-24)

The silent refused sign-in-method link is accepted as it is. Nothing to change.
