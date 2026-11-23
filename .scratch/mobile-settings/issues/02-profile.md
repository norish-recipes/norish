# 02: Profile, sign-in methods and delete account

**What to build:** The Profile sub-page (`StProfile`, `StPassword`, `StSignInSwiped`, `StDeleteAccount`), mirroring web's profile, sign-in methods and danger zone cards on `@norish/shared-react/reader`.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Name edit with Save; avatar change via the photo picker uploaded as an `expo-file-system` `File`, and avatar removal.
- [ ] Change password sheet (only when the account has a password).
- [ ] Sign-in methods listed; link opens the system auth session the app's OIDC sign-in uses; unlink by swipe or long-press; the last method cannot be removed.
- [ ] Delete account behind a destructive confirm, with web's admin note (`deleteModal.adminNote`); after deletion the app returns to sign-in.
- [ ] Gates green.

## Comments
