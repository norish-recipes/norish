## Why

The mobile auth screens added in the login-screen-overhaul change introduced several structural issues: tRPC is called without proper typing (cast to `any`), the connect-screen logic and login form have not been extracted into reusable hooks, style definitions are scattered inline rather than in dedicated files, and utility/style files live in the wrong folders. Additionally, the auto-redirect behaviour for a single OAuth provider is a UX problem — it bypasses the login screen without user intent.

## What Changes

- **Remove auto-redirect for single OAuth provider**: When exactly one OAuth provider is configured and no credential provider is present, the login screen currently auto-calls `handleOAuthSignIn` in a `useEffect`. This will be removed; the user sees the login screen normally and taps the provider button to authenticate.
- **Fix tRPC typing in `trpc-provider.tsx`**: Replace `createTRPCProviderBundle<any>` with `createTRPCProviderBundle<AppRouter>` (imported from `@norish/api/trpc`). This propagates full router types through `useTRPC()`, eliminating the `(trpc as any)` cast in `login.tsx` and `register.tsx`.
- **Extract tRPC hooks**: Move `useTRPC()` + `useQuery` calls out of `login.tsx` and `register.tsx` into dedicated hooks under `src/hooks/trpc/login/` following the web app's hook pattern.
- **Extract `useBackendUrl` hook**: Extract the `useEffect` in `(auth)/index.tsx` (connect screen) that loads the backend URL from secure store and redirects on cold start into a reusable hook `useBackendUrl`.
- **Split `login.tsx` into components**: Break `LoginForm` into smaller focused components — `ProviderLoadingState`, `ProviderErrorState`, `OAuthProviderList`, `CredentialForm`, `BackendMissingState` — each in its own file under `src/components/auth/login/`.
- **Move `auth-shell` to `components/shell/`**: Relocate `src/components/auth/auth-shell.tsx` into `src/components/shell/auth-shell.tsx` and update the barrel export.
- **Adopt Tailwind/className**: Replace `StyleSheet.create` colour/spacing values with Tailwind `className` props where HeroUI Native / NativeWind supports it. Remaining native-only styles go into `xxx.styles.ts` companion files.
- **Move styles to `src/styles/`**: Consolidate all `*.styles.ts` files from component directories into `src/styles/` (already started with `index.styles.ts`).
- **Move util files to `src/util/`**: Files that export pure functions (not components or hooks) — e.g. `sanitizeRedirectTarget`, `firstParam`, `toProviderType` in `login.tsx`, `normalizeBackendBaseUrl` helpers — should live in a `src/util/` folder.

## Capabilities

### New Capabilities

- `mobile-trpc-typing`: Typed tRPC client in the mobile app — `useTRPC()` returns a fully typed router interface derived from `AppRouter`, enabling correct autocompletion and eliminating `any` casts.
- `mobile-auth-hooks`: Dedicated hook layer for mobile auth tRPC calls and connect-screen URL logic, mirroring the web app's `hooks/<domain>/` pattern.

### Modified Capabilities

- `mobile-auth-login`: Remove auto-redirect scenario for single provider — the requirement "single OAuth provider auto-redirect" is being dropped.

## Impact

- `apps/mobile/src/providers/trpc-provider.tsx` — type parameter change
- `apps/mobile/src/app/(auth)/login.tsx` — hooks extracted, components split out, auto-redirect removed
- `apps/mobile/src/app/(auth)/register.tsx` — hooks extracted
- `apps/mobile/src/app/(auth)/index.tsx` — `useEffect` extracted to `useBackendUrl`
- `apps/mobile/src/components/auth/` — `auth-shell` moves out; `login/` subdirectory added
- `apps/mobile/src/components/shell/` — gains `auth-shell.tsx`
- `apps/mobile/src/hooks/trpc/login/` — new directory with auth-providers query hook
- `apps/mobile/src/hooks/` — new `useBackendUrl` hook
- `apps/mobile/src/util/` — new directory; receives pure utility functions from auth screens
- `apps/mobile/src/styles/` — consolidates all `*.styles.ts` files
- No API surface changes; no breaking changes to consumers outside `apps/mobile`
