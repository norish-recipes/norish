## 1. Fix tRPC Typing

- [x] 1.1 In `apps/mobile/src/providers/trpc-provider.tsx`, change `createTRPCProviderBundle<any>` to `createTRPCProviderBundle<AppRouter>` and add `import type { AppRouter } from '@norish/api/trpc'`
- [ ] 1.2 Run `tsc --noEmit` — confirm zero errors and no `any` cast required at the `useTRPC()` call sites

## 2. Extract tRPC Hook for Auth Providers

- [x] 2.1 Create `apps/mobile/src/hooks/trpc/login/use-auth-providers-query.ts` — calls `trpc.config.authProviders.queryOptions(undefined, { staleTime: 30_000 })` and returns `{ providers, registrationEnabled, passwordAuthEnabled, isLoading, error, refetch }`
- [x] 2.2 Replace the inline `useTRPC()` + `useQuery` call in `login.tsx`'s `LoginForm` with `useAuthProvidersQuery()`
- [x] 2.3 Remove the `(trpc as any)` cast from `login.tsx` — it must compile cleanly without it
- [x] 2.4 Check `register.tsx` for any direct `useTRPC()` / `useQuery` calls and extract similarly if present

## 3. Extract `useBackendUrl` Hook

- [x] 3.1 Create `apps/mobile/src/hooks/use-backend-url.ts` — moves the startup `useEffect` from `(auth)/index.tsx` verbatim, returns `{ baseUrl, setBaseUrl, isHydrated }`
- [x] 3.2 Update `apps/mobile/src/app/(auth)/index.tsx` to call `useBackendUrl()` and remove the inline `useEffect`
- [x] 3.3 Confirm `(auth)/index.tsx` still handles all three startup paths correctly (redirect / prefill / empty)

## 4. Remove Auto-Redirect for Single OAuth Provider

- [x] 4.1 Delete `shouldAutoRedirect` computation and the `useEffect` that calls `handleOAuthSignIn` automatically in `login.tsx`
- [x] 4.2 Delete `autoRedirectStarted` state
- [x] 4.3 Remove the `shouldAutoRedirect`-based `isDisabled` condition from OAuth provider buttons — buttons are only disabled while a sign-in is in progress (`activeOAuthProviderId !== null` or `isSubmittingCredentials`)

## 5. Split `login.tsx` into Sub-Components

- [x] 5.1 Create `apps/mobile/src/components/auth/login/provider-loading-state.tsx` — loading spinner + "Loading sign-in methods…" text
- [x] 5.2 Create `apps/mobile/src/components/auth/login/provider-error-state.tsx` — error card with retry button; accepts `onRetry` prop
- [x] 5.3 Create `apps/mobile/src/components/auth/login/no-providers-state.tsx` — "No sign-in methods available" message
- [x] 5.4 Create `apps/mobile/src/components/auth/login/credential-form.tsx` — email/password inputs + submit button; accepts `email`, `setEmail`, `password`, `setPassword`, `isSubmitting`, `onSubmit` props
- [x] 5.5 Create `apps/mobile/src/components/auth/login/oauth-provider-list.tsx` — maps OAuth providers to `<Button>` + `<ProviderIcon>`; accepts `providers`, `activeProviderId`, `isDisabled`, `onPress` props
- [x] 5.6 Create `apps/mobile/src/components/auth/login/backend-missing-state.tsx` — "Backend configuration required" card with "Open Connect" button
- [x] 5.7 Update `LoginForm` in `login.tsx` to render these components instead of inline JSX
- [ ] 5.8 Confirm `login.tsx` compiles cleanly and `tsc --noEmit` passes

## 6. Move `auth-shell` to `components/shell/`

- [x] 6.1 Move `apps/mobile/src/components/auth/auth-shell.tsx` → `apps/mobile/src/components/shell/auth-shell.tsx`
- [x] 6.2 Remove `AuthShell` from `apps/mobile/src/components/auth/index.ts` barrel
- [x] 6.3 Update all imports of `AuthShell` across the codebase (`(auth)/index.tsx`, `login.tsx`, `register.tsx`) to import from `@/components/shell/auth-shell`

## 7. Move Utility Functions to `src/util/`

- [x] 7.1 Create `apps/mobile/src/util/auth.ts` — move `sanitizeRedirectTarget`, `firstParam`, and `toProviderType` from `login.tsx`
- [x] 7.2 Update `login.tsx` imports to use `@/util/auth`
- [x] 7.3 Identify any other pure utility functions in auth screens (e.g. URL normalization helpers already in `lib/network/`) and note if they should also move (do not move files that are already correctly placed) (Noted: `(auth)/auth/error.tsx` has duplicate redirect helper candidates; URL normalization already lives correctly in `lib/network/backend-base-url.ts`.)

## 8. Consolidate Styles to `src/styles/`

- [x] 8.1 Move all `*.styles.ts` files from `apps/mobile/src/components/home/` to `apps/mobile/src/styles/` (e.g. `compact-recipe-card.styles.ts`, `mobile-recipe-card.styles.ts`, etc.)
- [x] 8.2 Update imports in their corresponding component files
- [x] 8.3 Review `(auth)/index.tsx`, `login.tsx`, and `register.tsx` — extract any `StyleSheet.create` blocks into companion `*.styles.ts` files in `src/styles/` if they contain more than trivial one-off values
- [x] 8.4 Replace inline `style={{ color: ..., fontWeight: '...' }}` with Tailwind `className` props where the value is static and NativeWind supports it (e.g. `className="font-semibold"`)

## 9. Verification

- [ ] 9.1 Run `tsc --noEmit` from `apps/mobile` — zero errors
- [ ] 9.2 Confirm all import paths resolve (no `Cannot find module` errors)
- [ ] 9.3 Test on iOS Simulator: connect screen cold start, login with single OAuth provider (no auto-redirect), credential login, register flow
