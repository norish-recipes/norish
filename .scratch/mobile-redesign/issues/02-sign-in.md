# 02: Sign in

**What to build:** Sign in rebuilt from the Login board. It shows exactly the Sign-in Methods the server reports, gives wrong credentials the inline error, and puts the glass server chip at the bottom. See `.scratch/mobile-redesign/spec.md` ("Sign-in Methods", "Errors") and the Login board (both `providers` states).

**Blocked by:** 01

**Status:** done

- [x] Layout per the board: "Sign in to" above the logo, the slogan, the email and password fields (show/hide password), "Don't have an account? Sign up" above the button, then the provider buttons.
- [x] The password form shows only when `passwordAuthEnabled`. The "or" divider shows only when there are both a password form and providers. The Sign up link shows only when `registrationEnabled && passwordAuthEnabled`. There is no automatic sign-in.
- [x] Wrong credentials show the inline error "Wrong email or password." Other failures map through `auth-failure.ts`.
- [x] AutoFill content types: `username` on email, `password` on password.
- [x] The server chip is an `@expo/ui` SwiftUI `Button` with the glass style, showing the host. It opens Server address pre-filled.
- [x] The loading, provider-error and no-providers states use the new layout. `login.styles.ts` is removed.
- [x] testIDs `login-email`, `login-password` and `login-submit` are kept.
- [x] Gates green.

## Comments

- The logo stays at `Brand`'s 168pt (the board draws 144) and the block is centred by `AuthLayout`, as on Server address; the chip sits in the layout's footer.
- `ServerChip` (`features/auth/components/server-chip.tsx`) takes the address, shows its host (port included) and pushes `/(auth)?change=server`; VoiceOver reads "Change server, connected to {host}" (`auth.login.changeServer` reworded, `auth.login.wrongServer` removed). Its glass needs iOS 26; earlier iOS draws SwiftUI's automatic style.
- Wrong credentials are Better Auth's `INVALID_EMAIL_OR_PASSWORD` code (`signInFailure`), copy in the new `auth.login.wrongCredentials`; web's `invalidCredentials` is untouched. A failed provider sign-in shows the same inline error under the provider buttons.
- Connect opened with `change` now `dismissAll()`s back to the Sign in below; a first-run Connect still replaces to `/login`. The no-server state (no auth client) is kept as a status block with "Open Connect".
- Unverified on a device: the chip's size and font, AutoFill, and the stacked-screen fix; Maestro covers them later.

### Review log (2026-11-12)

Range `c88cc2b49..a29738994`. Two axes, then three re-reviews of the fix rounds.

Fixed:
- One sign-in attempt at a time, one error, same-tick double submit dropped, a throwing task releases the form (`useAuthAttempt`); Server address runs through it too. `0b12a16bc`, `e02ac900a`, `34e88b6de`, `a29738994`
- Email's "next" key focuses the password. `7acc6c02d`
- Auth failures show translated copy only; a taken email says so. `6f83dd19d`, `eaa78ac04`
- A changed Server Address drops every cached answer; re-saving the same one changes nothing. `54792ee54`, `7187a28d9`
- Sign in shows a spinner, then fades the whole block in once; nothing moves on a layout change. `77c19f4df`, `71632e56a`, `52334f80c`
- Only `signIn.email` and `signIn.social` carry a 15 s deadline; a timeout reads "no server answered". `362b009e4`, `d5581288a`
- A failed background refetch keeps a loaded form up. `6b9284899`
- The chip fits the screen and truncates; icons 16/16. Logo at the Login board's 144pt (`Brand compact`). `d7f4d6146`, `fbe7b6bc6`
- The Sign up sentence is one 44pt link sized to its text. `f08b95830`, `04e61df33`
- A failure shakes only the input boxes; one haptic from `InlineError`. `e0b1f5d8a`
- Shared pieces: `AuthField`, `InlineErrorBlock`, `AuthSubmitButton`, `PasswordForm`/`ProviderButtons` in components, `failureFor`, `hostOf` util, `motion.ts`, named `noMethod`/`providerButtons`, the shared `AuthProvidersResponse`. `1f4cdd34d`, `25c66983b`, `21459b8db`, `1df03ab1d`, `bd412709f`, `f4fcbad30`, `4997b42c6`, `0ce02973a`, `d085dc57d`
- From ticket 01's open question: German devices get `de-informal`. `0e3f3d955`

Checked, no change needed:
- "Sign in to" already goes through `Brand`'s prefix; the other 17px line is the status title.
- The password toggle stays a `Pressable`, as in heroui-native's own InputGroup example.
- Provider ids are fixed in code (`credential | github | google | oidc`), so none can equal `"password"`.

Rejected:
- Remove `signInFailure` as speculative: it is the tested error-copy mapping the spec asks for.
- Bundle `authClient` and `signIn` into one prop: two distinct collaborators.
- Drop `Brand`'s `compact`: ticket 03 uses it.

Carried to ticket 03: offline with no cached methods, the paused query reports no loading and no error, so Sign in says there are no sign-in methods (`use-auth-providers-query.ts`). Older than this ticket.

Device run (06): AutoFill, the chip's size and font, the launch cross-fade to Sign in in both orders, VoiceOver on the Sign up link.

