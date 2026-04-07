## Context

The mobile app has three layers of offline infrastructure already in place:

1. **Network context** (`network-context.tsx`) — tracks device connectivity and backend reachability via WebSocket signals, exposing a tri-state `mode`: `offline`, `backend-unreachable`, or `online`.
2. **Query cache persistence** (`use-cache-hydration.ts`) — persists TanStack Query cache to MMKV, hydrated on cold start so cached data is available offline.
3. **Session revalidation** (`use-session-revalidation.ts`) — when `appOnline` transitions `false → true`, calls `getSession()` against the backend and signs out if the session is invalid.

The gap is in `AuthProviderInner`: it calls `authClient.useSession()` which makes a network request. When the backend is unreachable, this returns no session, so `isAuthenticated` stays `false` and `Stack.Protected` locks the user onto the login screen — even though they have a valid cached session cookie in `expo-secure-store` and cached query data in MMKV.

## Goals / Non-Goals

**Goals:**

- Allow previously-authenticated users to bypass the login screen when the backend is unreachable
- Use the locally-persisted session data from `expo-secure-store` as the auth source when offline
- Validate the cached session against the backend once connectivity is restored and sign out if invalid
- No UX disruption — the user should seamlessly transition between online and offline states

**Non-Goals:**

- Offline login (entering credentials while offline) — not supported
- Offline mutations (writes are already blocked by the mutation guard)
- Web app offline support — out of scope
- Token refresh while offline — not possible without backend

## Decisions

### D1: Read persisted session directly from SecureStore when offline

**Decision:** When the network context reports `mode !== 'online'`, the auth context will read the previously-persisted Better Auth session data from `expo-secure-store` (key `norish_session_data`) instead of relying on the reactive `authClient.useSession()` hook result.

**Rationale:** The `expoClient` plugin already persists session data (user object + session metadata) to SecureStore on every successful auth response. This data is available synchronously (SecureStore is an on-device encrypted store). Reading it directly avoids the network dependency.

**Alternatives considered:**

- _Intercepting the Better Auth fetch layer_ — too fragile, couples us to Better Auth internals.
- _Caching the last-known session in MMKV_ — redundant, SecureStore already has it.
- _Using a custom session atom/store_ — adds complexity; SecureStore is already the source of truth for the expo plugin.

### D2: Auth context consumes network state

**Decision:** `AuthProviderInner` will accept a `backendReachable` signal (from the `NetworkProvider`). When `backendReachable` is `false` and a cached session exists in SecureStore, the context will report `isAuthenticated: true` with the cached user data.

**Rationale:** This is the minimal change — the auth context already derives `isAuthenticated` from session data. We're just switching the data source based on connectivity.

**Provider ordering:** `NetworkProvider` already wraps `AuthProvider` in the layout tree (`_layout.tsx` lines 84–94), so the network state is available. We just need to pass it down or consume it inside `AuthProviderInner`.

### D2.1: Treat `runtimeState === 'initializing'` as a transitional auth phase

**Decision:** While `NetworkProvider` is still initializing reachability (`runtimeState === 'initializing'`), `AuthProviderInner` will report `isLoading: true` and preserve the current auth-derived `isAuthenticated` signal without forcing a SecureStore fallback read yet.

**Rationale:** `backendReachable` is initialized to `false` before WebSocket reachability signals arrive. If we immediately treat that as authoritative "offline," the app can briefly trust cached SecureStore session data even when backend reachability is about to become `online`.

**Behavioral intent:**

- avoid a startup flicker between unauthenticated/authenticated trees caused by transient `backendReachable: false`
- only choose the offline persisted-session path once reachability is in `ready` state and still unreachable

### D2.2: Require `NetworkProvider` for network-aware auth path

**Decision:** `AuthProviderInner` SHALL require `useNetworkStatus()` and not silently degrade when `NetworkProvider` is absent. The no-backend path (`backendBaseUrl: null`) remains handled by `AuthProvider` short-circuiting before `AuthProviderInner` mounts.

**Rationale:** The current network hook throws outside `NetworkProvider`; introducing optional fallback behavior increases hidden states and weakens guarantees. We already have a clear provider topology in `_layout.tsx`.

### D3: Rely on existing `useSessionRevalidation` for deferred validation

**Decision:** No new validation logic is needed. The existing `useSessionRevalidation` hook already watches for `appOnline` `false → true` transitions and calls `getSession()`. If the cached token turns out to be invalid, it calls `signOut()`.

**Rationale:** This hook is already mounted in `AuthenticatedProviders` and fully implements the reconnect validation flow, including transient error handling.

### D4: Add a `readPersistedSession` helper to `auth-storage.ts`

**Decision:** Add a function that reads and parses the `norish_session_data` key from SecureStore, returning the user object if present or `null` if missing/corrupted.

**Rationale:** Keeps the SecureStore key management centralized alongside `clearAuthStorage`. The auth context calls this helper rather than reaching into SecureStore directly.

**Validation contract:**

- parse JSON safely in `try/catch`
- require a `user` object with string `id`, `email`, `name`
- treat `image` as optional nullable string
- return `null` for shape mismatch, missing fields, empty payload, or parse failure
- log malformed payloads at `warn` level (without logging raw sensitive payload)

### D5: Keep this change intentionally narrow relative to `mobile-offline-resilience`

**Decision:** `offline-auth-bypass` is a targeted fix for immediate login-gate bypass using Better Auth's existing SecureStore session data. It does not introduce MMKV session snapshots. If `mobile-offline-resilience` proceeds with MMKV snapshots, that change must explicitly supersede this source-of-truth decision and include migration/cleanup tasks.

**Rationale:** Both changes are currently in progress and touch offline auth. Without an explicit boundary, we risk implementing two competing offline auth caches.

## Risks / Trade-offs

- **Stale session shown briefly** — If a user's session was revoked server-side while they were offline, they will see the app briefly until `useSessionRevalidation` signs them out on reconnect. This is acceptable because the cached data is read-only (mutations are blocked offline) and the window is short. → _Mitigation: existing revalidation hook handles this._

- **SecureStore data format coupling** — We depend on the internal format of Better Auth's `expoClient` session data key. If the plugin changes its serialization, parsing will fail. → _Mitigation: wrap in try/catch and fall back to `isAuthenticated: false` on parse failure._

- **Race condition on startup** — On cold start, the network state initializes as `backendReachable: false` briefly before the WebSocket connects. If we immediately read SecureStore, the user might flash as "authenticated offline" before transitioning to online. → _Mitigation: keep auth in transitional/loading behavior while `runtimeState === 'initializing'`, and only use persisted-session fallback once reachability is `ready` and still unreachable._

- **Startup reachability ambiguity** — `runtimeState` settles to `ready` independently from websocket connect timing, so there can still be a short "ready + unreachable" window before backend connect signal arrives. → _Mitigation: preserve auth-loading state during initialization and avoid forced auth-state flips until the first stable ready tick; rely on subsequent live session source once backend becomes reachable._
