## ADDED Requirements

### Requirement: Session is re-validated when app reachability is restored

When `appOnline` transitions from `false` to `true`, the auth system SHALL silently check whether the current session is still valid with the server.

#### Scenario: Session still valid on reconnect

- **WHEN** `appOnline` transitions from `false` to `true`
- **AND** the auth client calls `getSession()` and receives a valid session
- **THEN** the user SHALL remain authenticated
- **AND** no sign-out or redirect SHALL occur

#### Scenario: Session expired or revoked on reconnect

- **WHEN** `appOnline` transitions from `false` to `true`
- **AND** the auth client calls `getSession()` and receives a null/invalid response (e.g., 401 or empty session)
- **THEN** the auth system SHALL call `signOut()`
- **AND** the user SHALL be redirected to the login screen
- **AND** the persisted auth credentials in `expo-secure-store` SHALL be cleared

---

### Requirement: Auth tokens remain accessible offline

The Better Auth session cookie stored in `expo-secure-store` SHALL remain accessible when the device is offline. When the backend is unreachable, the auth context SHALL read the persisted session data directly from `expo-secure-store` and use it to determine authentication state, rather than relying on a network-dependent session check.

#### Scenario: Offline with persisted session

- **WHEN** the backend is unreachable (mode is `offline` or `backend-unreachable`)
- **AND** a valid session exists in `expo-secure-store` at the `norish_session_data` key
- **THEN** `useAuth()` SHALL return `isAuthenticated: true` and the cached `user` object parsed from the persisted session data
- **AND** the user SHALL be routed to the authenticated `(tabs)` stack, not the `(auth)` login screen

#### Scenario: Offline with no persisted session

- **WHEN** the backend is unreachable
- **AND** no session exists in `expo-secure-store`
- **THEN** `useAuth()` SHALL return `isAuthenticated: false`
- **AND** the user SHALL remain on the `(auth)` login screen

#### Scenario: Offline with corrupted persisted session

- **WHEN** the backend is unreachable
- **AND** the persisted session data in `expo-secure-store` cannot be parsed (e.g., invalid JSON, missing user fields)
- **THEN** `useAuth()` SHALL return `isAuthenticated: false`
- **AND** no error SHALL be thrown to the UI

---

### Requirement: Persisted session reader utility

The auth storage module SHALL expose a function to read and parse the persisted Better Auth session data from `expo-secure-store`.

#### Scenario: Valid persisted session exists

- **WHEN** `readPersistedSession()` is called
- **AND** the `norish_session_data` key contains valid JSON with a `user` object
- **THEN** the function SHALL return the parsed user object with `id`, `email`, `name`, and optional `image` fields

#### Scenario: No persisted session exists

- **WHEN** `readPersistedSession()` is called
- **AND** the `norish_session_data` key is empty or does not exist
- **THEN** the function SHALL return `null`

#### Scenario: Persisted session is corrupted

- **WHEN** `readPersistedSession()` is called
- **AND** the `norish_session_data` key contains data that cannot be parsed
- **THEN** the function SHALL return `null`
- **AND** the error SHALL be logged at `warn` level

---

### Requirement: Auth context uses network awareness for session source

The auth context SHALL use the backend reachability state to decide its session data source: the live Better Auth session hook when online, or the locally-persisted session when the backend is unreachable.

#### Scenario: Backend is reachable

- **WHEN** the backend is reachable (mode is `online`)
- **THEN** the auth context SHALL use the result from `authClient.useSession()` to determine `isAuthenticated` and `user`

#### Scenario: Backend becomes unreachable after being online

- **WHEN** the backend transitions from reachable to unreachable
- **AND** the auth context previously had a live session
- **THEN** the auth context SHALL continue reporting `isAuthenticated: true` with the last-known user data
- **AND** the user SHALL NOT be redirected to the login screen

#### Scenario: Cold start with backend unreachable

- **WHEN** the app cold-starts and the backend is unreachable
- **AND** a persisted session exists in `expo-secure-store`
- **THEN** the auth context SHALL read the persisted session and report `isAuthenticated: true`
- **AND** the user SHALL be routed directly to the `(tabs)` stack

#### Scenario: Startup reachability still initializing

- **WHEN** the app has mounted
- **AND** network reachability runtime state is still `initializing`
- **THEN** the auth context SHALL remain in a loading/transitional state
- **AND** it SHALL NOT prematurely force offline persisted-session auth resolution until reachability is `ready`

#### Scenario: Backend becomes reachable after offline period

- **WHEN** the backend transitions from unreachable to reachable
- **THEN** the auth context SHALL transition to using the live `authClient.useSession()` result
- **AND** the existing `useSessionRevalidation` hook SHALL validate the session and sign out if invalid

#### Scenario: Network provider topology requirement

- **WHEN** `AuthProviderInner` is used in the backend-configured app tree
- **THEN** it SHALL be mounted under `NetworkProvider`
- **AND** offline auth bypass behavior SHALL rely on `useNetworkStatus()` as a required dependency rather than optional fallback logic

---

### Requirement: Session re-validation does not block the UI

The reconnect session check SHALL be performed asynchronously in the background without blocking the user's interaction with cached data.

#### Scenario: User interacts during re-validation

- **WHEN** `appOnline` is restored and `getSession()` is in flight
- **THEN** the user SHALL be able to continue browsing cached data without interruption
- **AND** sign-out (if needed) SHALL occur after the response returns

---

### Requirement: Session re-validation handles transient network errors gracefully

If the session re-validation request fails due to a transient network error (e.g., timeout, DNS failure), the auth system SHALL NOT sign the user out immediately.

#### Scenario: Re-validation request fails transiently

- **WHEN** `appOnline` has transitioned to `true` but the `getSession()` call still fails with a transient network error
- **THEN** the auth system SHALL retry on the next reconnect cycle
- **AND** the user SHALL remain authenticated with cached session data
