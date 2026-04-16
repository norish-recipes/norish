## Requirements

### Requirement: Mobile routes are protected by default

The mobile app SHALL require an authenticated session before rendering protected application routes. Unauthenticated users SHALL be redirected to the login route.

#### Scenario: Unauthenticated cold start is redirected to login

- **WHEN** the app launches and no valid session exists
- **THEN** the app SHALL render the login screen instead of protected tab content

#### Scenario: Authenticated user enters protected app shell

- **WHEN** the app launches and a valid session exists
- **THEN** the app SHALL route the user to protected app content

#### Scenario: Session check is pending

- **WHEN** session state is still being resolved during app startup
- **THEN** the app SHALL show a deterministic loading state and SHALL NOT render protected content until session state is known

---

### Requirement: Login screen uses backend-configured providers

The mobile login experience SHALL display sign-in methods based on backend provider configuration so mobile and web use consistent auth availability.

#### Scenario: Provider discovery uses backend-resolved provider list

- **WHEN** the login screen loads
- **THEN** provider availability SHALL be fetched from a public tRPC procedure (`config.authProviders`) that reuses existing provider resolution semantics
- **AND** provider IDs, names, and types SHALL match backend configuration state

#### Scenario: OAuth providers are configured

- **WHEN** one or more OAuth/social providers are enabled on the backend
- **THEN** the login screen SHALL display those providers as sign-in options

#### Scenario: Credential provider is enabled

- **WHEN** password/credential auth is enabled on the backend
- **THEN** the login screen SHALL display credential sign-in in addition to OAuth providers

#### Scenario: No providers configured

- **WHEN** no sign-in provider is available from backend configuration
- **THEN** the login screen SHALL display a clear unavailable-auth message and SHALL NOT present broken sign-in actions

#### Scenario: Single OAuth provider auto-redirect

- **WHEN** exactly one OAuth provider is enabled and credential auth is disabled
- **THEN** login SHALL auto-start the OAuth provider flow without requiring a manual button tap

#### Scenario: Auto-redirect is skipped after explicit logout

- **WHEN** the user arrives at login from an explicit logout action
- **THEN** login SHALL NOT auto-start OAuth and SHALL remain on the login screen

---

### Requirement: OAuth sign-in completes with mobile deep-link callback

The mobile app SHALL support initiating OAuth sign-in and completing authentication through a mobile callback route.

#### Scenario: User starts social OAuth sign-in

- **WHEN** the user taps a social/OAuth provider button on login
- **THEN** the app SHALL start the provider auth flow using the BetterAuth backend

#### Scenario: OAuth callback succeeds

- **WHEN** the provider redirects back to the mobile callback route with a successful auth result
- **THEN** the app SHALL establish an authenticated session and route the user to protected app content

#### Scenario: OAuth callback fails

- **WHEN** provider authentication fails or callback payload is invalid
- **THEN** the app SHALL route to an auth error state with retry guidance

---

### Requirement: Intended destination is preserved through login

The mobile auth flow SHALL preserve the originally requested protected route and return the user there after successful login.

#### Scenario: Protected deep link requires auth

- **WHEN** an unauthenticated user opens a protected mobile route directly
- **THEN** the app SHALL redirect to login and retain the requested destination

#### Scenario: Post-login navigation returns to requested route

- **WHEN** the user completes login after being redirected from a protected route
- **THEN** the app SHALL navigate to the preserved destination instead of always using a fixed default route

---

### Requirement: Auth client configuration is driven by backend URL environment configuration

Mobile authentication requests SHALL use the configured backend URL environment variable as the auth API base URL.

#### Scenario: Valid backend URL configuration

- **WHEN** the backend URL environment variable is present and valid
- **THEN** mobile auth flows SHALL issue requests against that backend URL

#### Scenario: Missing or invalid backend URL configuration

- **WHEN** the backend URL environment variable is missing or malformed
- **THEN** login UI SHALL present a configuration error and SHALL block sign-in attempts until configuration is corrected

---

### Requirement: Session loss re-enforces route protection

The app SHALL re-apply authentication guards when a session becomes invalid during app lifetime.

#### Scenario: Session expires while app is running

- **WHEN** a previously authenticated user no longer has a valid session
- **THEN** the next protected route evaluation SHALL redirect the user to login
