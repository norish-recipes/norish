# 33: `features/auth` on web

**What to build:** Web's sign-in screens move from `app/(auth)/` into `features/auth`, as mobile's already are, and route files keep only the server work. After this ticket the whole E2E suite runs. Nothing visible changes. See `.scratch/app-structure/spec.md`, "Auth and the import move".

**Blocked by:** 30, 32

**Status:** ready-for-agent

- [ ] `features/auth` holds the login, signup and auth-error screens and their components (`login-client`, `email-password-form`, `provider-button`, `auto-sign-in`, `signup-client`, `signup-form`, `auth-alert`, `auth-card`, `auth-frame`, `auth-marks`).
- [ ] `app/(auth)/` keeps the layout, the `loading.tsx` files and each page's server work (the providers read, the auto-redirect decision), rendering the feature's screens.
- [ ] `components/auth/provider-icon.tsx` stays, since account draws it too.
- [ ] Moved tests run against the new homes; the lint rule's feature boundaries hold with no new exceptions.
- [ ] CONTRIBUTING.md's "Project Structure" and the Architecture page list `features/auth` and `components/imports/`, and drop `imports` as a feature (Terra's docs pass).
- [ ] Gates green: `pnpm lint`, `pnpm typecheck`, `pnpm test:run`, `pnpm i18n:check`, `pnpm build`, `pnpm format:check`, `pnpm deps:cycles`, and mobile's lint, typecheck, test and `expo export --platform ios`.
- [ ] The whole E2E suite (`ai`, `offline`, `realtime`) passes once, with no retries, and `base-path` on a `/norish` build; Maestro's sign-in and sign-out flows pass on iOS.

## Comments
