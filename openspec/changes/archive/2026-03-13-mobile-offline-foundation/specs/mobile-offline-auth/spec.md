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

The Better Auth session cookie stored in `expo-secure-store` SHALL remain accessible when the device is offline, allowing the auth context to report `isAuthenticated === true` based on the locally-persisted session.

#### Scenario: Offline with persisted session

- **WHEN** the device is offline
- **AND** a valid session exists in `expo-secure-store`
- **THEN** `useAuth()` SHALL return `isAuthenticated: true` and the cached `user` object

#### Scenario: Offline with no persisted session

- **WHEN** the device is offline
- **AND** no session exists in `expo-secure-store`
- **THEN** `useAuth()` SHALL return `isAuthenticated: false`

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
