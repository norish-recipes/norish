## ADDED Requirements

### Requirement: User can change backend server URL from login screen

The mobile app SHALL provide a mechanism on the login screen for the user to navigate back to the connect screen and enter a different backend server URL.

#### Scenario: Change server link is visible on login screen

- **WHEN** the login screen is displayed
- **THEN** a "Change server" button or link SHALL be visible below the sign-in form

#### Scenario: Navigating to change server

- **WHEN** the user taps "Change server"
- **THEN** the app SHALL navigate to the connect screen
- **AND** the previously saved backend URL SHALL be pre-populated in the connect screen input

#### Scenario: Submitting a new URL on the connect screen

- **WHEN** the user submits a new backend URL on the connect screen
- **THEN** the new URL SHALL be saved to `expo-secure-store`
- **AND** the app SHALL navigate to the login screen
- **AND** the BetterAuth auth client SHALL be re-initialized with the new URL without requiring an app restart

#### Scenario: Cancelling URL change

- **WHEN** the user navigates to the connect screen via "Change server" but does not submit
- **THEN** the previously saved backend URL SHALL remain unchanged
- **AND** navigating back to the login screen SHALL use the original URL

### Requirement: BetterAuth client re-initializes on URL change

The BetterAuth mobile client SHALL be re-created whenever the backend URL changes, without requiring an app restart.

#### Scenario: Auth client updated after URL change

- **WHEN** the backend URL stored in `expo-secure-store` changes
- **THEN** `AuthProvider` SHALL detect the change via a subscription to `backend-base-url`
- **AND** a new auth client instance SHALL be created via `getAuthClient(newUrl)`
- **AND** all downstream consumers of the auth client SHALL receive the updated instance

#### Scenario: Session invalidated after URL change

- **WHEN** the backend URL changes and the auth client is re-initialized
- **THEN** any prior authenticated session SHALL be considered invalid (the new server has no matching session)
- **AND** the user SHALL be presented with the login screen for the new server
