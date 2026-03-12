## Why

The current mobile auth implementation uses a custom server-side "handoff bridge" pattern (in-memory code store, three custom `/api/mobile-auth/*` endpoints, manual Bearer token lifecycle) that is non-standard, fragile in multi-instance deployments, and duplicates what BetterAuth's official `@better-auth/expo` plugin provides out of the box. The existing `MobileAuthGuard` component manually reimplements route protection that Expo Router's `Stack.Protected` API (SDK 53+) handles natively. The codebase also gratuitously prefixes everything with `mobile-` despite already living in `apps/mobile/`, and the login/connect screens have divergent styling with no transition between them.

## What Changes

- **Replace custom auth bridge with `@better-auth/expo`**: Delete the custom handoff store, `/api/mobile-auth/*` routes, manual Bearer token management, and bespoke `mobile-auth-service.ts`. Replace with BetterAuth's official Expo server plugin (`expo()`) and client plugin (`expoClient()`), which handle OAuth flows, secure cookie storage, and session management automatically.
- **Remove `bearer()` plugin**: The `bearer()` plugin in the server auth config was added exclusively for the mobile custom bridge. With `@better-auth/expo`, the mobile app uses cookie-based auth (cookies stored in SecureStore, sent via `Cookie` header). The `bearer()` plugin is no longer needed.
- **Replace `MobileAuthGuard` with `Stack.Protected`**: Delete the manual guard component that uses `<Redirect>` based on segment parsing. Use Expo Router's declarative `Stack.Protected` with `guard` props in the root layout to gate `(tabs)` behind authentication and restrict `(auth)`/`connect` to unauthenticated state.
- **Create a lazy-initialized BetterAuth client**: Since the backend URL is configured at runtime (via the `/connect` screen), the `createAuthClient` instance must be created lazily when the URL becomes available, and recreated if it changes.
- **Switch tRPC auth transport from Bearer to Cookie**: The `MobileTrpcProvider` currently injects `Authorization: Bearer <token>`. It will instead use `authClient.getCookie()` to inject the `Cookie` header, matching BetterAuth's expected transport.
- **Unify login and connect screen styling**: Both screens get a shared visual layout (centered card, consistent typography/spacing) so they feel like one coherent auth flow.
- **Add transition animation between connect and login**: Move `/connect` into the `(auth)` route group and configure `Stack` screen animations for a smooth transition.
- **Drop `mobile-` prefix from all filenames and exports**: Rename `mobile-auth-context.tsx` to `auth-context.tsx`, `mobile-trpc-provider.tsx` to `trpc-provider.tsx`, etc. All symbols like `MobileTrpcProvider`, `useMobileTRPC`, `useMobileAuth` lose the `Mobile` prefix.
- **Add `mobile://` to server `trustedOrigins`**: Required by `@better-auth/expo` for deep link redirects after OAuth.

## Capabilities

### New Capabilities

- `mobile-auth`: Covers the BetterAuth Expo integration (client creation, OAuth flow, cookie-based session transport, session hooks) and route protection via `Stack.Protected`. Replaces the previous custom bridge approach entirely.

### Modified Capabilities

_(none -- no existing spec-level requirements change)_

## Impact

- **Server (`packages/auth`)**: Add `@better-auth/expo` dependency, add `expo()` plugin, add `mobile://` trusted origin, remove `bearer()` plugin.
- **Server (`apps/web`)**: Delete `apps/web/app/api/mobile-auth/` (3 route files) and `apps/web/lib/auth/mobile-handoff-store.ts`. Remove `/api/mobile-auth` from proxy matcher.
- **Mobile (`apps/mobile`)**: Add `@better-auth/expo`, `expo-network`, `expo-linking` dependencies. Rewrite auth context to use BetterAuth client. Delete manual session token storage, auth service, and auth guard. Restructure root layout to use `Stack.Protected`. Rename all files/exports to drop `mobile-` prefix. Restyle login and connect screens.
- **Shared (`packages/shared-react`)**: The `getHeaders` option added to `createTRPCProviderBundle` stays (it's a clean extension), but the mobile provider switches from Bearer to Cookie.
- **Shared (`packages/shared/contracts`)**: The `oauthProviderType` field on `ProviderInfo` is no longer needed (the expo client plugin handles social vs oauth2 routing internally). Can be removed.
