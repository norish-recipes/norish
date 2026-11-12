# 02: Sign in

**What to build:** Sign in rebuilt from the Login board. It shows exactly the Sign-in Methods the server reports, gives wrong credentials the inline error, and puts the glass server chip at the bottom. See `.scratch/mobile-redesign/spec.md` ("Sign-in Methods", "Errors") and the Login board (both `providers` states).

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Layout per the board: "Sign in to" above the logo, the slogan, the email and password fields (show/hide password), "Don't have an account? Sign up" above the button, then the provider buttons.
- [ ] The password form shows only when `passwordAuthEnabled`. The "or" divider shows only when there are both a password form and providers. The Sign up link shows only when `registrationEnabled && passwordAuthEnabled`. There is no automatic sign-in.
- [ ] Wrong credentials show the inline error "Wrong email or password." Other failures map through `auth-failure.ts`.
- [ ] AutoFill content types: `username` on email, `password` on password.
- [ ] The server chip is an `@expo/ui` SwiftUI `Button` with the glass style, showing the host. It opens Server address pre-filled.
- [ ] The loading, provider-error and no-providers states use the new layout. `login.styles.ts` is removed.
- [ ] testIDs `login-email`, `login-password` and `login-submit` are kept.
- [ ] Gates green.
