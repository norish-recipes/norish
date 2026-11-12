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
