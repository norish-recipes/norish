## Why

The mobile app cannot be used offline when the backend is unreachable — even though we have a working query cache and an offline banner. The root cause is that `authClient.useSession()` in the auth context makes a network request to the backend. When the backend is down, the session check fails, `isAuthenticated` stays `false`, and Expo Router's `Stack.Protected` guard locks the user on the login screen. Users who were previously authenticated and have valid cached data cannot access it.

## What Changes

- **Offline session resolution**: When the backend is unreachable, the auth context will read the persisted session data from `expo-secure-store` to determine authentication state instead of relying on a network call.
- **Deferred token validation**: Token validation is deferred until the backend becomes reachable again. The existing `useSessionRevalidation` hook already handles this — it signs the user out if the session is invalid on reconnect.
- **Auth context network awareness**: The `AuthProvider` will consume network state to decide whether to trust the locally-cached session or require a live session check.
- **Startup transition guard**: During network reachability initialization, auth remains in a transitional loading state to avoid false offline resolution and auth flicker.
- **Scope boundary with parallel offline work**: This is a narrow SecureStore-based bypass fix; if MMKV session snapshots from `mobile-offline-resilience` are adopted later, that change will explicitly supersede and clean up this path.

## Capabilities

### New Capabilities

_(none — this change modifies an existing capability)_

### Modified Capabilities

- `mobile-offline-auth`: Add requirement that the auth context resolves authentication state from locally-persisted session data when the backend is unreachable, rather than blocking on a network call.

## Impact

- `apps/mobile/src/context/auth-context.tsx` — primary change: read cached session from SecureStore when offline
- `apps/mobile/src/lib/auth-storage.ts` — may need a helper to read (not just clear) the persisted session
- `apps/mobile/src/app/_layout.tsx` — provider ordering may need adjustment to ensure `NetworkProvider` wraps `AuthProvider`
- `openspec/changes/mobile-offline-resilience/*` — alignment note may be needed to avoid dual offline auth sources
- No backend/API changes required
- No web app changes (web has no offline mode)
- No database or schema changes
