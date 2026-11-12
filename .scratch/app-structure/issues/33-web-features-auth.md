# 33: `features/auth` on web

**What to build:** Web's sign-in screens move from `app/(auth)/` into `features/auth`, as mobile's already are, and route files keep only the server work. After this ticket the whole E2E suite runs. Nothing visible changes. See `.scratch/app-structure/spec.md`, "Auth and the import move".

**Blocked by:** 30, 32

**Status:** ready-for-agent

- [x] `features/auth` holds the login, signup and auth-error screens and their components (`login-client`, `email-password-form`, `provider-button`, `auto-sign-in`, `signup-client`, `signup-form`, `auth-alert`, `auth-card`, `auth-frame`, `auth-marks`).
- [x] `app/(auth)/` keeps the layout, the `loading.tsx` files and each page's server work (the providers read, the auto-redirect decision), rendering the feature's screens.
- [x] `components/auth/provider-icon.tsx` stays, since account draws it too.
- [x] Moved tests run against the new homes; the lint rule's feature boundaries hold with no new exceptions.
- [x] CONTRIBUTING.md's "Project Structure" and the Architecture page list `features/auth` and `components/imports/`, and drop `imports` as a feature (Terra's docs pass).
- [x] Gates green: `pnpm lint`, `pnpm typecheck`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build`, `pnpm format:check`, `pnpm deps:cycles`, and mobile's lint, typecheck, test and `expo export --platform ios`.
- [ ] The whole E2E suite (`ai`, `offline`, `realtime`) passes once, with no retries, and `base-path` on a `/norish` build; Maestro's sign-in and sign-out flows pass on iOS.

## Comments

- 2026-11-12 (implementer): screens follow the other features' naming: `login-client`/`signup-client` became `login-screen`/`signup-screen` (`LoginScreen`, `SignupScreen`), and auth-error's client body became `auth-error-screen.tsx` with a three-line `page.tsx`. Components sit in `features/auth/components/`.
- `components/skeleton/login-skeleton.tsx` moved into `features/auth/components/` too, since it draws `AuthCard` and shared code may not import a feature; the two `loading.tsx` import it directly. Both auth tests moved to `features/auth/__tests__/`.
- Open demo-instance ticket 02 named the old form path, so it now points at the new one (separate commit). Old tickets marked resolved keep their history.
- Gates green, plus the auth E2E specs (ai: sign-in-methods, auth-gate, page-transitions, 16/16; offline: session-expiry, 1/1). Not done here: the docs box (Terra) and the full E2E/base-path/Maestro box (gatekeeper).

### Review (Opus high, standards + spec) and dispositions

The spec review compared every moved file with `153668651`: a faithful move, no behaviour difference, nothing broken outside it.

1. **fix**: the route decides the auto-redirect and `login-screen.tsx` works the same thing out again. The route hands the screen the one provider to sign in with.
2. **fix**: `login-skeleton.tsx` also holds `SignupSkeleton`, mixing a default and a named export; comments in the moved files that describe rather than name the mechanism, and two over the two-line limit; two `log.debug` calls in a row in `auth-error-screen.tsx`; two lint warnings in `provider-button.tsx`.
3. **fix**: `components/shared/auth-language-selector.tsx` exports one function both named and default, and its two consumers import it differently; `__tests__/app/auth/signed-in-layout.test.tsx` tests the `(app)` layout from a folder that now reads like the feature's.
4. **reject**: resolved tickets in other `.scratch` features naming `app/(auth)/…`. They are a record of what was done then.

Fix round (`b68bf67ea..9b546dd56`): 1-3 fixed. The login route passes `autoSignInProvider`; `signup-skeleton.tsx` is its own file; `signed-in-layout.test.tsx` sits in `__tests__/app/`. Docs: `aaf3e75d5`. Gates green on that state; the auth-touching `ai` specs 16/16. The last checkbox waits on the closing sweep and the final pass.
