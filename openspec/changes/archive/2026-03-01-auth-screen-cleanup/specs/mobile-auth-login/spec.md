## REMOVED Requirements

### Requirement: Single OAuth provider auto-redirect

**Reason**: Auto-redirecting without user intent produces a confusing UX — users see a blank screen that immediately navigates to an external browser without any acknowledgement. Showing the login screen with the single provider button is clearer and more intentional.
**Migration**: No migration required. The login screen will display the OAuth provider button as normal; users tap it to begin the flow.

#### Scenario: Single OAuth provider auto-redirect

- **WHEN** exactly one OAuth provider is enabled and credential auth is disabled
- **THEN** login SHALL auto-start the OAuth provider flow without requiring a manual button tap

#### Scenario: Auto-redirect is skipped after explicit logout

- **WHEN** the user arrives at login from an explicit logout action
- **THEN** login SHALL NOT auto-start OAuth and SHALL remain on the login screen

## MODIFIED Requirements

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

#### Scenario: Single OAuth provider shows login screen normally

- **WHEN** exactly one OAuth provider is enabled and credential auth is disabled
- **THEN** the login screen SHALL display the provider button as a normal tappable option
- **AND** the app SHALL NOT auto-initiate the OAuth flow without user interaction
