## 1. Install Dependencies and Configure Bundler

- [x] 1.1 Add `@better-auth/expo` to `packages/auth` (server plugin) and `apps/mobile` (client plugin)
- [x] 1.2 Add `better-auth` to `apps/mobile` dependencies (for `createAuthClient` from `better-auth/react`)
- [x] 1.3 Add `expo-network` and `expo-linking` to `apps/mobile` dependencies
- [x] 1.4 Enable `unstable_enablePackageExports` in `apps/mobile/metro.config.js`

## 2. Server-Side Auth Changes

- [x] 2.1 Add `expo()` plugin from `@better-auth/expo` to the BetterAuth plugins array in `packages/auth/src/auth.ts`
- [x] 2.2 Add `"mobile://"` to `trustedOrigins` in `packages/auth/src/auth.ts`
- [x] 2.3 Remove the `bearer()` plugin import and usage from `packages/auth/src/auth.ts`
- [x] 2.4 Remove `oauthProviderType` field additions from `packages/auth/src/providers.ts` (revert uncommitted changes)
- [x] 2.5 Remove `oauthProviderType` from `ProviderInfo` in `packages/shared/src/contracts/dto/auth.ts` (revert uncommitted changes)

## 3. Delete Custom Bridge Code

- [x] 3.1 Delete `apps/web/app/api/mobile-auth/` directory (callback, exchange, error routes)
- [x] 3.2 Delete `apps/web/lib/auth/mobile-handoff-store.ts`
- [x] 3.3 Remove `api/mobile-auth` from the proxy matcher in `apps/web/proxy.ts` (revert uncommitted change)

## 4. Create Auth Client Module

- [x] 4.1 Create `apps/mobile/src/lib/auth-client.ts` with lazy-initialized `createAuthClient` using `expoClient` plugin (scheme `"mobile"`, storagePrefix `"norish"`, storage `expo-secure-store`)
- [x] 4.2 Export `getAuthClient(baseUrl)` function that creates/caches the client per URL

## 5. Rewrite Auth Context

- [x] 5.1 Rename `apps/mobile/src/context/mobile-auth-context.tsx` to `auth-context.tsx`
- [x] 5.2 Rewrite context to use `authClient.useSession()` for session state instead of manual token management
- [x] 5.3 Expose `backendBaseUrl`, `authClient` instance, `isAuthenticated`, `isLoading`, and `justLoggedOut` flag
- [x] 5.4 Remove all manual session resolution, token storage, refresh intervals, and AppState listeners (handled by expoClient plugin)
- [x] 5.5 Rename exports: `MobileAuthProvider` -> `AuthProvider`, `useMobileAuth` -> `useAuth`

## 6. Rewrite tRPC Provider

- [x] 6.1 Rename `apps/mobile/src/providers/mobile-trpc-provider.tsx` to `trpc-provider.tsx`
- [x] 6.2 Switch `getHeaders` from Bearer token to Cookie header using `authClient.getCookie()`
- [x] 6.3 Remove `authToken` prop; the provider only needs `baseUrl`
- [x] 6.4 Rename exports: `MobileTrpcProvider` -> `TrpcProvider`, `useMobileTRPC` -> `useTRPC`, `useMobileConnectionStatus` -> `useConnectionStatus`
- [x] 6.5 Update all import references across the mobile app to use new names

## 7. Restructure Routes and Add Stack.Protected

- [x] 7.1 Move `apps/mobile/src/app/connect.tsx` into `apps/mobile/src/app/(auth)/connect.tsx`
- [x] 7.2 Rewrite `apps/mobile/src/app/_layout.tsx` root layout to use `Stack` with `Stack.Protected` guards: `(auth)` guarded by `!isAuthenticated`, `(tabs)` guarded by `isAuthenticated`
- [x] 7.3 Add loading state rendering in root layout while session is resolving (neither guard active)
- [x] 7.4 Update `(auth)/_layout.tsx` to configure Stack animation (e.g., `fade_from_bottom`) between connect and login screens
- [x] 7.5 Delete `apps/mobile/src/components/auth/mobile-auth-guard.tsx`

## 8. Rewrite Login Screen

- [x] 8.1 Rewrite `apps/mobile/src/app/(auth)/login.tsx` to use `authClient.signIn.social()` for OAuth and `authClient.signIn.email()` for credentials instead of manual service calls
- [x] 8.2 Remove dependency on `useMobileTRPC` for provider discovery; use `authClient` or a direct fetch to the providers endpoint
- [x] 8.3 Remove all `beginOAuthSignIn`, `completeOAuthCode`, `signInWithPassword` manual wiring
- [x] 8.4 Keep auto-redirect logic for single-provider case, respecting `justLoggedOut` flag

## 9. Unify Styling

- [x] 9.1 Align login screen styling to match connect screen layout: same padding, gap, eyebrow/title/subtitle sizes, card styling
- [x] 9.2 Optionally extract shared style constants or a shared `AuthScreenLayout` wrapper component if duplication is significant
- [x] 9.3 Update connect screen to navigate to `/login` after successful URL save (instead of `/recipes`), letting the guard handle the final redirect

## 10. Update Callback and Error Screens

- [x] 10.1 Review `apps/mobile/src/app/(auth)/auth/callback.tsx` -- the expoClient plugin handles cookie extraction from the deep link automatically, so this screen may become a simple passthrough or can be removed if the plugin handles routing
- [x] 10.2 Review `apps/mobile/src/app/(auth)/auth/error.tsx` -- update to work with the expo plugin's error deep link format (error params may differ)

## 11. Delete Dead Code

- [x] 11.1 Delete `apps/mobile/src/lib/auth/mobile-auth-service.ts`
- [x] 11.2 Delete `apps/mobile/src/lib/auth/mobile-auth-session-token.ts`
- [x] 11.3 Delete `apps/mobile/src/lib/auth/mobile-auth-routing.ts` (routing helpers no longer needed with Stack.Protected)
- [x] 11.4 Update `apps/mobile/src/app/(tabs)/profile.tsx` to use new `useAuth` import and `authClient.signOut()` instead of manual signOut

## 12. Update Remaining Import References

- [x] 12.1 Search and replace all `useMobileAuth` -> `useAuth` imports across mobile app
- [x] 12.2 Search and replace all `useMobileTRPC` -> `useTRPC` imports across mobile app
- [x] 12.3 Search and replace all `MobileTrpcProvider` -> `TrpcProvider` references
- [x] 12.4 Verify no remaining references to deleted files or old export names

## 13. Verification

- [x] 13.1 Run TypeScript type-check across the mobile app and server packages
- [x] 13.2 Verify Metro bundler resolves all BetterAuth imports with `unstable_enablePackageExports`
- [x] 13.3 Verify no references remain to `/api/mobile-auth`, `bearer()`, `mobile-auth-service`, `mobile-auth-guard`, or `mobile-handoff-store`

## 14. Add Registration Support

- [x] 14.1 Add `AuthProvidersResponse` type to `packages/shared/src/contracts/dto/auth.ts` with `providers: ProviderInfo[]`, `registrationEnabled: boolean`, `passwordAuthEnabled: boolean`
- [x] 14.2 Update `config.authProviders` tRPC procedure in `packages/api/src/trpc/routers/config/procedures.ts` to return `AuthProvidersResponse` (call `isRegistrationEnabled()` and `isPasswordAuthEnabled()` alongside `getAvailableProviders()`)
- [x] 14.3 Update mobile login screen (`apps/mobile/src/app/(auth)/login.tsx`) to destructure `providers`, `registrationEnabled`, `passwordAuthEnabled` from the new response shape
- [x] 14.4 Add "Don't have an account? Sign up" link on mobile login screen, visible only when `registrationEnabled && passwordAuthEnabled`; navigates to `/register`
- [x] 14.5 Create registration screen at `apps/mobile/src/app/(auth)/register.tsx` with name, email, password, confirm password fields; calls `authClient.signUp.email()`; uses same unified auth screen styling
- [x] 14.6 Add "Already have an account? Sign in" link on registration screen, navigating to `/login`
- [x] 14.7 Handle registration-disabled state on register screen (if user navigates directly) -- show message and link back to login
- [x] 14.8 Update any web callers of `config.authProviders` to handle the new response shape (object with `providers` key instead of bare array) -- N/A: web login page calls `getAvailableProviders()` directly server-side, not via tRPC
- [x] 14.9 Run TypeScript type-check across affected packages
