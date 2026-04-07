## Architecture

Replace the custom mobile auth bridge with BetterAuth's official `@better-auth/expo` plugin, using cookie-based session transport. Replace the manual `MobileAuthGuard` with Expo Router's `Stack.Protected` API. Unify the connect and login screens into a single `(auth)` route group with shared styling and transitions.

```
┌─────────────────────────────────────────────────────────────────┐
│                    NEW MOBILE AUTH FLOW                          │
└─────────────────────────────────────────────────────────────────┘

  Mobile (expoClient plugin)         Server (expo plugin)          Provider
  ────────────────────────           ──────────────────            ────────
      │                                   │                           │
  1.  │─ authClient.signIn.social({       │                           │
      │    provider, callbackURL })       │                           │
      │                                   │                           │
      │  (plugin converts callbackURL     │                           │
      │   to deep link: mobile://...)     │                           │
      │                                   │                           │
  2.  │─ POST /api/auth/sign-in/social ──▶│                           │
      │   + Cookie header from SecureStore│                           │
      │                                   │                           │
  3.  │◀─ { url, redirect: true }         │                           │
      │                                   │                           │
      │  (plugin opens proxy endpoint)    │                           │
      │                                   │                           │
  4.  │─ Browser.openAuthSessionAsync ───▶│ /expo-authorization-proxy │
      │                                   │  (sets state cookie,      │
      │                                   │   redirects to provider)  │
      │                                   │──────────────────────────▶│
      │                                   │                           │
  5.  │                                   │◀── callback with code ────│
      │                                   │                           │
  6.  │                                   │  (server exchanges code,  │
      │                                   │   PKCE for OIDC,          │
      │                                   │   creates session,        │
      │                                   │   expo hook appends       │
      │                                   │   cookie to deep link)    │
      │                                   │                           │
  7.  │◀── deep link: mobile://...        │                           │
      │     ?cookie=<set-cookie-header>   │                           │
      │                                   │                           │
  8.  │  (plugin extracts cookie,         │                           │
      │   stores in SecureStore,          │                           │
      │   notifies session signal)        │                           │
      └───────────────────────────────────┘
```

## Key Design Decisions

### 1. Lazy-Initialized Auth Client

The backend URL is configured at runtime via the connect screen. BetterAuth's `createAuthClient` requires a `baseURL` at creation time. Solution: use a lazy proxy pattern.

```ts
// apps/mobile/src/lib/auth-client.ts
let _client: ReturnType<typeof createAuthClient> | null = null;
let _currentBaseUrl: string | null = null;

export function getAuthClient(baseUrl: string) {
  if (_client && _currentBaseUrl === baseUrl) return _client;

  _client = createAuthClient({
    baseURL: baseUrl,
    plugins: [
      expoClient({
        scheme: "mobile",
        storagePrefix: "norish",
        storage: SecureStore,
      }),
    ],
  });
  _currentBaseUrl = baseUrl;
  return _client;
}
```

This creates the client on first access and recreates it if the URL changes. The auth context calls `getAuthClient(backendBaseUrl)` when the URL is available.

### 2. Route Protection with Stack.Protected

The root layout uses `Stack` with `Stack.Protected` guards instead of the manual `MobileAuthGuard`:

```
_layout.tsx (root)
├── Stack.Protected guard={!isAuthenticated}   ← shown when NOT logged in
│   ├── (auth)                                  ← login, connect, callback, error
│   └── connect screen is now INSIDE (auth)
│
├── Stack.Protected guard={isAuthenticated}     ← shown when logged in
│   └── (tabs)                                  ← recipes, groceries, calendar, etc.
```

Auth state comes from `authClient.useSession()`. When the guard flips (login -> authenticated), Expo Router automatically redirects to the first available protected route and cleans up history. No manual `<Redirect>` logic needed.

The `backendBaseUrl === null` case (no server configured) is handled inside the `(auth)` group: the `(auth)/_layout.tsx` checks for the URL and shows the connect screen as the initial route when missing.

### 3. Route Structure Changes

**Before:**

```
app/
  _layout.tsx        ← RootLayoutContent + MobileAuthGuard
  connect.tsx        ← top-level route
  (auth)/
    _layout.tsx
    login.tsx
    auth/callback.tsx
    auth/error.tsx
  (tabs)/
    _layout.tsx
    ...
```

**After:**

```
app/
  _layout.tsx        ← Stack with Stack.Protected guards
  (auth)/
    _layout.tsx      ← Stack with animations, handles connect-vs-login routing
    connect.tsx      ← moved here from top level
    login.tsx
    auth/callback.tsx  ← kept for deep link handling (may still need URL param parsing)
    auth/error.tsx
  (tabs)/
    _layout.tsx
    ...
```

### 4. tRPC Provider -- Cookie Transport

The tRPC provider switches from Bearer token to Cookie header:

```ts
getHeaders: () => {
  const client = getAuthClient(baseUrl);
  const cookies = client.getCookie();
  if (!cookies) return {};
  return { Cookie: cookies };
};
```

The `authToken` prop is removed. The `providerKey` still changes when the base URL changes to force reconnection, but no longer tracks an auth token.

### 5. Unified Auth Screen Styling

Both connect and login share the same visual structure:

```
┌──────────────────────────────────┐
│                                  │
│   Norish                         │  ← eyebrow (accent color)
│   Screen Title                   │  ← large title
│   Subtitle / description         │  ← muted text
│                                  │
│   ┌────────────────────────────┐ │
│   │                            │ │
│   │   Card content             │ │  ← secondary card, rounded-3xl
│   │   (form / buttons / etc)   │ │
│   │                            │ │
│   └────────────────────────────┘ │
│                                  │
│   Helper text / errors           │
│                                  │
└──────────────────────────────────┘
```

The connect screen already uses this layout. The login screen's styling is aligned to match: same `paddingHorizontal: 20`, same `gap`, same eyebrow/title/subtitle font sizes. Both use `ScrollView` with `contentInsetAdjustmentBehavior="always"` and `justifyContent: 'center'`.

### 6. Transition Animation

The `(auth)` Stack layout configures a crossfade or slide animation between connect and login:

```ts
<Stack screenOptions={{
  headerShown: false,
  animation: 'fade_from_bottom',  // or 'slide_from_right'
}}>
```

When the user submits a valid backend URL on the connect screen, instead of `router.replace('/recipes')`, it navigates to `/login`. The `Stack.Protected` guard handles the final redirect to `(tabs)` once authenticated.

### 7. Server-Side Changes

**Add `expo()` plugin:**

```ts
import { expo } from "@better-auth/expo";
// ...
plugins: [
  genericOAuth({ ... }),
  apiKey({ ... }),
  expo(),
  nextCookies(),
]
```

**Add trusted origin:**

```ts
trustedOrigins: [
  SERVER_CONFIG.AUTH_URL,
  ...SERVER_CONFIG.TRUSTED_ORIGINS,
  "mobile://",
  // ... dev origins
];
```

**Remove `bearer()` plugin** -- no longer needed.

**Remove `/api/mobile-auth` from proxy matcher** -- these routes are deleted.

### 8. Auth Context Simplification

The current `MobileAuthContext` manages: status, sessionToken, user, justLoggedOut, isSigningOut, refreshSession, completeOAuthCallback, completeOAuthCode, signInWithPassword, beginOAuthSignIn, signOut, consumeLogoutFlag.

With `@better-auth/expo`, most of this is handled by `authClient.useSession()` and direct `authClient.signIn.*` / `authClient.signOut()` calls. The context simplifies to:

- `backendBaseUrl` (from storage, same as before)
- `authClient` instance (lazy-created from URL)
- A thin wrapper around `useSession()` for the `isAuthenticated` / `isLoading` state the guards need
- `justLoggedOut` flag (to prevent auto-redirect after explicit logout)

The 200+ line context file shrinks to ~50 lines.

### 9. Files Deleted

| File                                                    | Reason                                             |
| ------------------------------------------------------- | -------------------------------------------------- |
| `apps/web/app/api/mobile-auth/callback/route.ts`        | Replaced by expo plugin's authorization proxy      |
| `apps/web/app/api/mobile-auth/exchange/route.ts`        | No more handoff codes                              |
| `apps/web/app/api/mobile-auth/error/route.ts`           | Errors handled via deep link params by expo plugin |
| `apps/web/lib/auth/mobile-handoff-store.ts`             | In-memory store no longer needed                   |
| `apps/mobile/src/lib/auth/mobile-auth-service.ts`       | Replaced by authClient methods                     |
| `apps/mobile/src/lib/auth/mobile-auth-session-token.ts` | SecureStore managed by expoClient plugin           |
| `apps/mobile/src/components/auth/mobile-auth-guard.tsx` | Replaced by Stack.Protected                        |

### 10. Files Renamed (drop `mobile-` prefix)

| Before                                 | After                                                 |
| -------------------------------------- | ----------------------------------------------------- |
| `context/mobile-auth-context.tsx`      | `context/auth-context.tsx`                            |
| `providers/mobile-trpc-provider.tsx`   | `providers/trpc-provider.tsx`                         |
| `MobileAuthProvider` / `useMobileAuth` | `AuthProvider` / `useAuth`                            |
| `MobileTrpcProvider` / `useMobileTRPC` | `TrpcProvider` / `useTRPC`                            |
| `MobileAuthShell`                      | `AuthShell` (or removed entirely if guards handle it) |

### 11. Metro Config

Add `unstable_enablePackageExports` for BetterAuth module resolution:

```js
const config = getDefaultConfig(__dirname);
config.resolver.unstable_enablePackageExports = true;
```

### 12. Registration Screen

The mobile app needs a registration screen for when the server has registration enabled and the credential (email/password) provider is configured.

**Backend: Expose registration status**

The `config.authProviders` tRPC endpoint currently returns `ProviderInfo[]`. It needs to return an enriched response that also includes `registrationEnabled` and `passwordAuthEnabled` booleans. This is a **breaking change** to the return type -- changing from a bare array to an object:

```ts
// packages/api/src/trpc/routers/config/procedures.ts
const authProviders = publicProcedure.query(async () => {
  const [providers, registrationEnabled, passwordAuthEnabled] = await Promise.all([
    getAvailableProviders(),
    isRegistrationEnabled(),
    isPasswordAuthEnabled(),
  ]);
  return { providers, registrationEnabled, passwordAuthEnabled };
});
```

Both the mobile login screen and web login page consume this endpoint. The web login page (`apps/web/app/(auth)/login/page.tsx`) currently calls `isRegistrationEnabled()` server-side, so it doesn't strictly need the tRPC change -- but for consistency, both can use it. The web callers need updating to handle the new shape (`data.providers` instead of `data` directly).

**Shared DTO update**

Add an `AuthProvidersResponse` type to `packages/shared/src/contracts/dto/auth.ts`:

```ts
export interface AuthProvidersResponse {
  providers: ProviderInfo[];
  registrationEnabled: boolean;
  passwordAuthEnabled: boolean;
}
```

**Mobile: Registration screen**

Add `apps/mobile/src/app/(auth)/register.tsx` with the same layout as the login/connect screens (eyebrow, title, subtitle, card). The form collects:

- Name (text input)
- Email (email input)
- Password (secure text)
- Confirm password (secure text)

Validation matches the web: password 8-128 chars, passwords must match.

On submit, calls `authClient.signUp.email({ name, email, password })`. Since BetterAuth's `emailAndPassword` config has `autoSignIn: true`, a successful signup automatically establishes a session, and `Stack.Protected` handles the redirect to `(tabs)`.

**Mobile: Conditional navigation links**

The login screen shows "Don't have an account? Sign up" below the credential form when `registrationEnabled && passwordAuthEnabled` (from the providers response). This links to `/register`.

The register screen shows "Already have an account? Sign in" below the form, linking back to `/login`.

Both links are only shown when appropriate -- registration link only when registration is enabled, and only when the credential provider is available (OAuth users don't need a separate registration form).

### 13. Route Structure (Updated)

With the registration screen, the `(auth)` route group becomes:

```
app/
  _layout.tsx        ← Stack with Stack.Protected guards
  (auth)/
    _layout.tsx      ← Stack with animations
    connect.tsx
    login.tsx
    register.tsx     ← NEW: registration form
    auth/callback.tsx
    auth/error.tsx
  (tabs)/
    _layout.tsx
    ...
```

### 14. Dependencies

**Add to server (`packages/auth` or root):**

- `@better-auth/expo` (server plugin)

**Add to mobile (`apps/mobile`):**

- `@better-auth/expo` (client plugin)
- `better-auth` (for `createAuthClient` from `better-auth/react`)
- `expo-network` (required by expoClient for connectivity detection)
- `expo-linking` (required by expoClient for deep link URL creation)

**Already installed (no changes):**

- `expo-web-browser` (used internally by expoClient)
- `expo-secure-store` (used as storage for expoClient)
- `expo-constants` (used by expoClient to read scheme)

**Remove from server auth config:**

- `bearer` import from `better-auth/plugins` (no longer used)
