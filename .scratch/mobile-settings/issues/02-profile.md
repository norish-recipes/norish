# 02: Profile, sign-in methods and delete account

**What to build:** The Profile sub-page (`StProfile`, `StPassword`, `StSignInSwiped`, `StDeleteAccount`), mirroring web's profile, sign-in methods and danger zone cards on `@norish/shared-react/reader`.

**Blocked by:** 01

**Status:** ready-for-agent

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
