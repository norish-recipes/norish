# 01: Splash and Server address

**What to build:** The app opens on the splash and hands off to Server address with the Launch board's glide, and Server address is rebuilt from the Connect board, error state included. This ticket also builds the pieces later screens reuse: the vertically centred auth layout, the help popover, and the inline error. See `.scratch/mobile-redesign/spec.md` ("Look", "Motion", "Errors") and the Main, Launch and Connect boards.

**Blocked by:** none

**Status:** ready-for-agent

- [ ] `expo-haptics` added through `expo install`.
- [ ] Splash: the JS first frame matches the native splash's logo position exactly, then fades the translated slogan in. The boot phase decides what comes next: the glide into Server address, a cross-fade to Sign in, or a fade to the signed-in screen. Reduce Motion gets fades only.
- [ ] Server address: the logo and slogan, the field with its server icon, a `?` button opening an `@expo/ui` `Popover` with the example, and the Connect button with its checking state.
- [ ] Inline error: a danger border, a danger line rising in, one shake and one error haptic. Copy: "No Norish server answered at this address."
- [ ] The slogan key `auth.login.subtitle` reads "Any recipe, any source." in English, and the other locales follow.
- [ ] The language menu (`auth-locale-menu.tsx`, `shell-menu.tsx`) and the `(auth)` header's `headerRight` are removed. `connect.styles.ts` is removed. `AuthShell` is replaced by the new layout. The layout's stale `animation` comment is fixed.
- [ ] Code touched here uses the glossary's name (`ServerAddress…` for `BackendBaseUrl…`).
- [ ] testIDs `connect-server-url` and `connect-submit` are kept.
- [ ] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.
