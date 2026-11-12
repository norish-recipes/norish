# 01: Splash and Server address

**What to build:** The app opens on the splash and hands off to Server address with the Launch board's glide, and Server address is rebuilt from the Connect board, error state included. This ticket also builds the pieces later screens reuse: the vertically centred auth layout, the help popover, and the inline error. See `.scratch/mobile-redesign/spec.md` ("Look", "Motion", "Errors") and the Main, Launch and Connect boards.

**Blocked by:** none

**Status:** ready-for-agent

- [x] `expo-haptics` added through `expo install`.
- [x] Splash: the JS first frame matches the native splash's logo position exactly, then fades the translated slogan in. The boot phase decides what comes next: the glide into Server address, a cross-fade to Sign in, or a fade to the signed-in screen. Reduce Motion gets fades only.
- [x] Server address: the logo and slogan, the field with its server icon, a `?` button opening an `@expo/ui` `Popover` with the example, and the Connect button with its checking state.
- [x] Inline error: a danger border, a danger line rising in, one shake and one error haptic. Copy: "No Norish server answered at this address."
- [x] The slogan key `auth.login.subtitle` reads "Any recipe, any source." in English, and the other locales follow.
- [x] The language menu (`auth-locale-menu.tsx`, `shell-menu.tsx`) and the `(auth)` header's `headerRight` are removed. `connect.styles.ts` is removed. `AuthShell` is replaced by the new layout. The layout's stale `animation` comment is fixed.
- [x] Code touched here uses the glossary's name (`ServerAddress…` for `BackendBaseUrl…`).
- [x] testIDs `connect-server-url` and `connect-submit` are kept.
- [x] Gates green, including mobile's lint, typecheck, test and `expo export --platform ios`.

## Comments

- The native splash's `imageWidth` went from 175 to 168 (app.json) so the splash, the JS first frame and the boards share one logo size; the next iOS build needs `expo prebuild` for it to take.
- One shared clock in `components/launch.tsx` runs the launch; Server address measures its brand so the glide lands on it. The cross-fade to Sign in and the fade to the signed-in screen are the same splash fade over the screen beneath.
- Every Connect failure but a malformed URL shows "No Norish server answered at this address."; a failed save shows `common.errors.operationFailed`. The `connect` keys moved to `serverAddress*`, `title`/`timeout`/`unreachableWithReason` went. The rename covered the `lib/network/server-address` module and its callers; the stored key's value is unchanged.
- Not done: signed-out screens following the device language (spec "Look") — no ticket lists it, and the fallback still picks the stored locale or English. Popover sizing and the glide landing are unverified on a device until the Maestro run.
