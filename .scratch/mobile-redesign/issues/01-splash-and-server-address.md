# 01: Splash and Server address

**What to build:** The app opens on the splash and hands off to Server address with the Launch board's glide, and Server address is rebuilt from the Connect board, error state included. This ticket also builds the pieces later screens reuse: the vertically centred auth layout, the help popover, and the inline error. See `.scratch/mobile-redesign/spec.md` ("Look", "Motion", "Errors") and the Main, Launch and Connect boards.

**Blocked by:** none

**Status:** done

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

### Review log (2026-11-12)

Range `e4a94c883..4521a20ce`. Two axes, then three narrow re-reviews of the fix rounds.

Fixed:
- Signed-out screens follow the device language (`matchDeviceLocale`, `CFBundleLocalizations` + a test tying it to the catalogue). `21965b941`, `dc6c0b75b`, `4521a20ce`
- The error line rises 16pt, plain fade under Reduce Motion. `9bf6efae3`
- The splash always leaves: no glide target at the end of the hold means a fade (`resolveLaunchMotion`). `8a584fabf`
- Launch timeline on the Launch board's timing; one `progress()` helper. `4ad835a4b`, `6fd51be32`
- The launch clock runs under Reduce Motion (fades only); a fading splash has the screen drawn beneath it. `11eb22e2e`, `646763949`
- Popover text uses Inter's PostScript name, 16pt icon. `368ea391e`
- Server address draws from its first render; the signed-out stack opens on Sign in when an address is saved (`resolveSignedOutEntry`), and the async draft hook is gone. `c8fb941a3`, `95d70d635`, `885008ea4`
- Comments trimmed, Connect's message ids typed, the rewritten `activeLocale` memos made plain. `4e5d8d208`, `20838477e`, `13af5e6ea`

Checked, no change needed:
- First-frame colours vs the native splash: the in-app appearance overrides the window the native splash view sits in, so there is no flip at the JS hand-off.
- The error line's icon matches the Connect board.
- `loadLocalePreference`/`saveLocalePreference` are still used by the signed-in provider.

Rejected:
- Rename `auth.login.subtitle` to a slogan key: the spec names that key, and web reads it.
- Drop `HelpPopover`'s `icon` prop: ticket 03 uses the `i` variant.
- Move Register onto the inline error: ticket 03.
- Split `launch.tsx` / rename `useLaunchEntrance`: one launch timeline with one landing, by spec.
- Translate `accessibilityLabel="Norish"`; capitalise "Server address" in comments: brand name; the spec's screen name.
- Sign in falling back to the server's default locale, not English: it follows the server's enabled locales.
- Three `@eslint-react` warnings in `mobile-i18n-context.tsx`: present at the baseline.

Asked (open): a German device resolves to `de-formal`, the catalogue's first German locale. Should it be `de-informal`?

For later tickets:
- Any "open Server address" must push `/(auth)?change=server`, or a saved address opens Sign in (02 chip, 04, 05).
- Older than this ticket: "Change server" then Connect with the same address leaves two Sign in screens stacked (`connect-screen.tsx` `replace("/login")`). Ticket 02's chip should fix it.
- Device run (06): `expo prebuild` first (splash width 168, `CFBundleLocalizations`); check the glide landing, popover sizing and font, `pt-PT` and Nynorsk matching, and whether the smoke → Sign in replace animates on Sign-out.

### Device round (2026-11-12)

The maintainer ran the app on the simulator: the splash flickered and the screens did not follow the boards. Range `9311803f1..ce359f914`, verified by frame analysis of recorded launches and measured screenshots, then one review.

Fixed:
- The flicker: the native splash was hidden from an effect before the first JS frame was drawn (about 0.9 s of bare background). It now hides from the overlay's `onLayout`, and the clock starts after and steps at most two frames at a time (`stepLaunchClock`). `3c0662960`
- The dark splash logo's cream matches the SVG. `c838dcdb9`
- Splash position: logo and slogan centred as one group as on the Main board (logo top 398pt), the native PNGs padded so the hand-off stays in the same pixels. `4839f1c35`
- Board values in the shared pieces (also tickets 02 and 03): fields 52pt on Server address and 50pt on the forms, 1pt border, no shadow; the 52pt primary button; Sign in's block 40pt from the top; divider, provider buttons, spacing; an `--accent-text` token for links and the chip icon. `c94bb5260`, `7aaaf8833`, `984e9b56b`, `033ce27e6`, `e795f5a0f`, `d2b83df78`, `2594fe3c2`
- From the review: the token first shipped as `--link`, which HeroUI uses, and would have turned web's links green (renamed); Sign in's status screens and spinner are centred again; a comment corrected. `2594fe3c2`, `b61a7cf19`, `ce359f914`

Rejected: remove the accent border on a focused field (the boards draw no focused state; a visible one stays).

Left as built: the danger red is the theme token web shares; the plug icon's glyph; the native popover's and chip's chrome.

Asked (open): the light logo changes colour at the hand-off on the simulator (launch image rgb(27,103,61), app rgb(51,102,65)); the PNG is #336640 and iOS appears to read it as Display P3. An iOS-only pre-compensated image would fix it; unconfirmed on a real iPhone.

Device run (06), not yet seen on a device: Server address's error state, help popover and dark mode; Sign in and Sign up against their boards.

